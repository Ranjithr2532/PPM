import json
import re
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import requests

router = APIRouter(tags=["AI Email Extraction"])

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:270m"


# ============================================================
# REQUEST
# ============================================================

class EmailRequest(BaseModel):
    email_text: str


# ============================================================
# RESPONSE
# ============================================================

class ProposalExtraction(BaseModel):
    email_to: List[str] = Field(default_factory=list)
    email_cc: List[str] = Field(default_factory=list)

    customer_name: Optional[str] = None
    kind_attention: Optional[str] = None
    customer_address: Optional[str] = None

    reference: Optional[str] = None
    proposal_subject: Optional[str] = None

    introductory_paragraph: Optional[str] = None

    scope_of_work: List[str] = Field(default_factory=list)
    objectives: List[str] = Field(default_factory=list)
    technical_requirements: List[str] = Field(default_factory=list)
    commercial_requirements: List[str] = Field(default_factory=list)

    implementation_timeline: Optional[str] = None

    additional_requirements: List[str] = Field(default_factory=list)
    attachments: List[str] = Field(default_factory=list)

    missing_information: List[str] = Field(default_factory=list)


# ============================================================
# HELPER PARSING FUNCTIONS
# ============================================================

def clean_reference_subject(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r'^(?:(?:re|fwd|fw)\s*:\s*)+', '', cleaned, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else None


def clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()
    return cleaned


def extract_proposal_from_raw_text(text: str, ai_data: Optional[dict] = None) -> dict:
    """
    Robust rule-based and NLP parsing engine to reliably extract all proposal
    parameters from raw email threads, complementing Ollama LLM extraction.
    """
    if ai_data is None:
        ai_data = {}

    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    all_emails = re.findall(email_pattern, text)

    # 1. Emails: To, CC
    to_match = re.search(r'(?:To|to):\s*([^\n\r]+)', text)
    cc_match = re.search(r'(?:Cc|CC|cc):\s*([^\n\r]+)', text)

    email_to = []
    if to_match:
        email_to = re.findall(email_pattern, to_match.group(1))
    if not email_to:
        email_to = [e for e in all_emails if not e.endswith('cmti.res.in')]

    email_cc = []
    if cc_match:
        email_cc = re.findall(email_pattern, cc_match.group(1))

    # 2. Subject & Reference
    subject_match = re.search(r'(?:Subject|subject):\s*([^\n\r]+)', text)
    raw_subject = subject_match.group(1).strip() if subject_match else ""
    cleaned_ref = clean_reference_subject(raw_subject)
    reference = cleaned_ref if cleaned_ref else None

    # Proposal Subject
    proposal_subject = None
    if reference:
        if re.search(r'techno|proposal|project|quotation', reference, re.IGNORECASE):
            cleaned_title = re.sub(r'^(?:request\s+to\s+send\s+|request\s+for\s+)', '', reference, flags=re.IGNORECASE).strip()
            # Clean hyphens with spaces: "techno - commercial" -> "Techno-Commercial"
            cleaned_title = re.sub(r'\btechno\s*-\s*commercial\b', 'Techno-Commercial', cleaned_title, flags=re.IGNORECASE)
            proposal_subject = cleaned_title.title()
            if not proposal_subject.lower().startswith('techno-commercial'):
                proposal_subject = f"Techno-Commercial Proposal for {proposal_subject}"
        else:
            proposal_subject = f"Techno-Commercial Proposal for {reference}".strip()

    # 3. Signature & Customer details
    sender_name_from_header = None
    from_match = re.search(r'From:\s*([^\n\r<]+)(?:<([^\n\r>]+)>)?', text, re.IGNORECASE)
    if from_match:
        raw_name = from_match.group(1).strip().strip('"').strip("'")
        if '@' not in raw_name and len(raw_name) > 2:
            sender_name_from_header = raw_name
        elif from_match.group(2) or ('@' in raw_name):
            email_val = from_match.group(2).strip() if from_match.group(2) else raw_name
            user_part = email_val.split('@')[0]
            if not user_part.isdigit():
                user_clean = re.sub(r'[._]', ' ', user_part)
                user_clean = re.sub(r'([a-z])([A-Z])', r'\1 \2', user_clean)
                sender_name_from_header = user_clean.title()

    sig_patterns = [
        r'(?:सादर\s*/\s*Regards|Regards|Warm\s+regards|Sincerely|Thanks\s+&?\s+Regards|Thanks\s+and\s+Regards|Thank\s+you|Thanks)[,\s\n:]+([\s\S]*?)(?=(?:\n\s*(?:On\s+\d{4}|From:|-{3,}|Confidentiality\s+Notice|\d{1,2}/\d{1,2}/\d{2,4}|https?://)|\Z))',
    ]

    sig_lines = []
    for pat in sig_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            raw_lines = [
                l.strip() for l in m.group(1).splitlines()
                if l.strip() and not l.strip().startswith(('Phone', 'Cell', 'Tel', 'Email', 'about:', 'http', 'Not in Contacts', 'Fax', 'Confidentiality', 'https'))
            ]
            if raw_lines:
                sig_lines = raw_lines
                break

    customer_name = None
    person_name = None
    designations = []
    customer_address = None
    address_parts = []

    for idx, line in enumerate(sig_lines):
        clean_latin = re.sub(r'[^\x00-\x7F]+', '', line).strip(' /,-')
        if not clean_latin:
            continue

        line_eval = clean_latin

        # Check for Address (PIN code or city names)
        if re.search(r'\d{6}', line_eval) or any(c in line_eval.upper() for c in ['KADAPA', 'BANGALORE', 'BENGALURU', 'HYDERABAD', 'CHENNAI', 'DELHI', 'MUMBAI', 'PUNE', 'ANDHRA', 'KARNATAKA', 'TAMIL NADU', 'TELANGANA', 'JALAHALLI']):
            if "CMTI" not in line_eval.upper() and not re.search(r'(?:College|Institute|University|Limited|Ltd|Corporation|Enterprises)', line_eval, re.IGNORECASE):
                address_parts.append(line_eval)
                continue

        # Check for Organization / Customer Name
        if re.search(r'(?:College|Institute|University|Pvt|Ltd|Limited|Technologies|Corporation|Inc|Autonomous|Hospital|Organization|Bharat Electronics|BEL|BHEL|HAL|ISRO|DRDO|Tata|Infosys|Wipro)', line_eval, re.IGNORECASE):
            if "CMTI" not in line_eval.upper():
                if not customer_name:
                    customer_name = line_eval
                continue

        # Check for Person Name or Designation
        if re.search(r'^(?:Dr|Prof|Mr|Mrs|Ms|Er)\.?\s+', line_eval, re.IGNORECASE):
            person_name = line_eval
        elif any(k in line_eval.lower() for k in ['engineer', 'manager', 'professor', 'dean', 'director', 'scientist', 'head', 'lead', 'executive', 'officer', 'department', 'fabrication', 'components', 'ece', 'cse', 'mech', 'eee', 'civil']):
            designations.append(line_eval)
        elif not person_name and idx == 0 and len(line_eval.split()) <= 4:
            person_name = line_eval

    if not person_name and sender_name_from_header:
        person_name = sender_name_from_header

    kind_attention_parts = []
    if person_name:
        kind_attention_parts.append(person_name)
    if designations:
        kind_attention_parts.extend(designations)

    kind_attention = "\n".join(kind_attention_parts) if kind_attention_parts else person_name
    
    # Deduplicate address parts
    clean_addr_parts = []
    for a in address_parts:
        if a and a not in clean_addr_parts:
            clean_addr_parts.append(a)
    customer_address = ", ".join(clean_addr_parts) if clean_addr_parts else None

    # 4. Objectives
    objectives = []
    obj_match = re.search(r'(?:Objective|Objectives|Goal|Goals)[:\s\n]+([\s\S]*?)(?=(?:I confirm|Scope|Please send|Thank you|Regards|\n\s*\n\s*[A-Z]|\Z))', text, re.IGNORECASE)
    if obj_match:
        obj_text = obj_match.group(1).strip()
        for line in obj_text.splitlines():
            line_str = line.strip()
            if line_str and (line_str.startswith(('•', '-', '*', '1.', '2.', '3.', 'To ', 'to ')) or len(line_str) > 10):
                cleaned_obj = re.sub(r'^[•\-\*\d\.\s]+', '', line_str).strip()
                if cleaned_obj and len(cleaned_obj) > 5:
                    objectives.append(cleaned_obj)

    # 5. Introductory Paragraph
    introductory_paragraph = None
    body_match = re.search(r'(?:Dear\s+sir|Dear\s+madam|Good\s+morning|Hello|Hi)[,\s\n]+([\s\S]*?)(?=(?:Objective|Scope|I confirm|Thank you|Regards))', text, re.IGNORECASE)
    if body_match:
        intro_text = body_match.group(1).strip()
        intro_text = re.sub(r'^(?:Good morning|Good afternoon|Dear sir|Dear madam)[,\s\n]+', '', intro_text, flags=re.IGNORECASE).strip()
        if intro_text:
            introductory_paragraph = " ".join([l.strip() for l in intro_text.splitlines() if l.strip()])

    # 6. Scope of Work
    scope_of_work = []
    if objectives:
        for obj in objectives:
            if obj.lower().startswith(('to develop', 'to design', 'to explore', 'to evaluate', 'to detect', 'to build', 'develop', 'design', 'explore', 'detect')):
                scope_of_work.append(obj)
    if not scope_of_work and objectives:
        scope_of_work = list(objectives)

    # 7. Technical Requirements
    technical_requirements = []
    tech_keywords = [
        "non-destructive", "non-invasive", "portable", "sensitivity", "sensing",
        "low-cost", "accurate", "detection", "monitor", "sealed packet", "sensor",
        "microcontroller", "spectroscopy", "hardware", "software", "accuracy",
        "testing", "measurement"
    ]
    for sentence in re.split(r'[.\n]', text):
        s_clean = sentence.strip()
        if any(k in s_clean.lower() for k in tech_keywords) and len(s_clean) > 15:
            if not any(s_clean.lower().startswith(p) for p in ['dear', 'subject', 'to:', 'from:', 'date:', '3/']):
                technical_requirements.append(s_clean)
    technical_requirements = list(dict.fromkeys(technical_requirements))[:5]

    # 8. Commercial Requirements
    commercial_requirements = []
    if re.search(r'resource\s+person\s+charges', text, re.IGNORECASE):
        commercial_requirements.append("Resource person charges")
    if re.search(r'experimentation\s+charges', text, re.IGNORECASE):
        commercial_requirements.append("Experimentation charges")
    if re.search(r'quotation|commercial\s+proposal|cost\s+estimate', text, re.IGNORECASE):
        commercial_requirements.append("Techno-commercial proposal & quotation")
    if not commercial_requirements and re.search(r'proposal', text, re.IGNORECASE):
        commercial_requirements.append("Techno-commercial quotation")

    # 9. Implementation Timeline
    implementation_timeline = None
    timeline_match = re.search(r'(?:during\s+the\s+summer|within\s+\d+\s+(?:months|weeks|days)|\d+\s+to\s+\d+\s+months|\d+\s+months)', text, re.IGNORECASE)
    if timeline_match:
        implementation_timeline = timeline_match.group(0).strip()

    # 10. Additional Requirements
    additional_requirements = []
    student_match = re.search(r'([^.\n]*?(?:students\s+can\s+join|interns|training|internship)[^.\n]*)', text, re.IGNORECASE)
    if student_match:
        additional_requirements.append(student_match.group(1).strip())

    # 11. Attachments
    attachments = []
    att_matches = re.findall(r'[\w\-.]+\.(?:pdf|docx|doc|xlsx|csv|pptx|png|jpg)', text, re.IGNORECASE)
    if att_matches:
        attachments = list(dict.fromkeys(att_matches))

    # Helper to clean list fields from AI hallucinations and dummy placeholders
    def clean_list_field(ai_val, fallback_val=None):
        dummy_phrases = ["array of", "list of", "none", "null", "n/a", "not mentioned", "[]", "dummy"]
        candidates = []
        if isinstance(ai_val, list):
            for item in ai_val:
                if item is not None:
                    s = str(item).strip()
                    if len(s) > 2 and not any(dp in s.lower() for dp in dummy_phrases):
                        candidates.append(s)
        elif isinstance(ai_val, str):
            s = ai_val.strip()
            if len(s) > 2 and not any(dp in s.lower() for dp in dummy_phrases):
                if "\n" in s:
                    for line in s.splitlines():
                        cleaned = re.sub(r'^[•\-\*\d\.\s]+', '', line).strip()
                        if len(cleaned) > 2 and not any(dp in cleaned.lower() for dp in dummy_phrases):
                            candidates.append(cleaned)
                elif "," in s and len(s) > 10:
                    for part in s.split(","):
                        cleaned = part.strip()
                        if len(cleaned) > 2 and not any(dp in cleaned.lower() for dp in dummy_phrases):
                            candidates.append(cleaned)
                elif len(s) > 5:
                    candidates.append(s)

        if candidates:
            return list(dict.fromkeys(candidates))

        if fallback_val and isinstance(fallback_val, list):
            clean_fb = []
            for item in fallback_val:
                if item is not None:
                    s = str(item).strip()
                    if len(s) > 2 and not any(dp in s.lower() for dp in dummy_phrases):
                        clean_fb.append(s)
            return list(dict.fromkeys(clean_fb))

        return []

    # Ensure customer_name (organization) is found from text/signature if not yet set
    if not customer_name:
        org_m = re.search(r'([^\n\r,]+(?:Limited|Ltd|Pvt\s+Ltd|College|University|Institute|Corporation|Technologies|Industries|Enterprises|Hospital|Autonomous|Bharat Electronics|BEL|BHEL|HAL|ISRO|DRDO|Tata|Infosys|Wipro)[^\n\r,]*)', text, re.IGNORECASE)
        if org_m and "CMTI" not in org_m.group(1).upper():
            customer_name = org_m.group(1).strip().strip(' /,-')

    ai_cust = ai_data.get("customer_name")
    if ai_cust:
        ai_cust_str = str(ai_cust).strip()
        if (
            "@" in ai_cust_str
            or "Dr." in ai_cust_str
            or "Mr." in ai_cust_str
            or "array of" in ai_cust_str.lower()
            or (person_name and person_name.lower() in ai_cust_str.lower())
            or (kind_attention and ai_cust_str.lower() in kind_attention.lower())
        ):
            ai_cust = None

    ai_ref = ai_data.get("reference")
    if ai_ref and (re.match(r'^\d[\d\s]+$', str(ai_ref)) or "array of" in str(ai_ref).lower() or "Limited" in str(ai_ref) or "Bangalore" in str(ai_ref)):
        ai_ref = None

    ai_kind = ai_data.get("kind_attention")
    if ai_kind and (ai_kind.lower() in ["person", "null", "none"] or "array of" in str(ai_kind).lower() or "@" in str(ai_kind)):
        ai_kind = None
    elif ai_kind and isinstance(ai_kind, str) and "," in ai_kind and "\n" not in ai_kind:
        ai_kind = "\n".join([p.strip() for p in ai_kind.split(",") if p.strip()])
    if not ai_kind and kind_attention:
        ai_kind = kind_attention

    ai_addr = ai_data.get("customer_address")
    if ai_addr and ("College" in ai_addr or "Institute" in ai_addr or ai_addr == customer_name or "array of" in str(ai_addr).lower()):
        ai_addr = None
    if not ai_addr and customer_address:
        ai_addr = customer_address

    ai_intro = ai_data.get("introductory_paragraph")
    if ai_intro and ("background text" in str(ai_intro).lower() or "array of" in str(ai_intro).lower()):
        ai_intro = None

    # Final cleanup of customer_name and customer_address
    final_cust = customer_name or ai_cust
    if final_cust and ("@" in str(final_cust) or str(final_cust).lower() in ["none", "null", "n/a"]):
        final_cust = None

    final_addr = customer_address or ai_addr
    if final_addr:
        if "@" in str(final_addr) or str(final_addr).lower() in ["none", "null", "n/a"]:
            final_addr = None
        else:
            pieces = [p.strip() for p in str(final_addr).split(',') if p.strip()]
            final_addr = ", ".join(list(dict.fromkeys(pieces)))

    final_data = {
        "email_to": clean_list_field(ai_data.get("email_to"), email_to),
        "email_cc": clean_list_field(ai_data.get("email_cc"), email_cc),
        "customer_name": final_cust,
        "kind_attention": ai_kind or kind_attention,
        "customer_address": final_addr,
        "reference": clean_reference_subject(ai_ref or reference),
        "proposal_subject": ai_data.get("proposal_subject") or proposal_subject,
        "introductory_paragraph": ai_intro or introductory_paragraph,
        "scope_of_work": clean_list_field(ai_data.get("scope_of_work"), scope_of_work),
        "objectives": clean_list_field(ai_data.get("objectives"), objectives),
        "technical_requirements": clean_list_field(ai_data.get("technical_requirements"), technical_requirements),
        "commercial_requirements": clean_list_field(ai_data.get("commercial_requirements"), commercial_requirements),
        "implementation_timeline": ai_data.get("implementation_timeline") if ai_data.get("implementation_timeline") and "stated timeline" not in str(ai_data.get("implementation_timeline")).lower() else implementation_timeline,
        "additional_requirements": clean_list_field(ai_data.get("additional_requirements"), additional_requirements),
        "attachments": clean_list_field(ai_data.get("attachments"), attachments),
        "missing_information": []
    }

    # Missing Information
    missing = []
    if not final_data["customer_name"]:
        missing.append("Customer name")
    if not final_data["customer_address"]:
        missing.append("Customer address")
    if not final_data["proposal_subject"]:
        missing.append("Proposal subject")
    if not (final_data["scope_of_work"] or final_data["objectives"] or final_data["technical_requirements"]):
        missing.append("Project requirement")

    final_data["missing_information"] = missing
    return final_data


# ============================================================
# API ENDPOINT
# ============================================================

@router.post(
    "/ai/extract-email",
    response_model=ProposalExtraction
)
def extract_email(data: EmailRequest):

    prompt = f"""Read this customer email and extract proposal details into JSON.

Email:
\"\"\"
{data.email_text}
\"\"\"

Extract these JSON keys accurately:
- customer_name: organization/college name (e.g. KSRM College of Engineering)
- kind_attention: person name & designation
- customer_address: city/state/pincode
- reference: original subject without Re/Fwd
- proposal_subject: title like "Techno-Commercial Proposal for ..."
- introductory_paragraph: background text
- scope_of_work: array of work activities
- objectives: array of objectives
- technical_requirements: array of technical specifications
- commercial_requirements: array of quotation/cost requirements
- implementation_timeline: stated timeline
- additional_requirements: array of other requests
- attachments: array of filenames
- email_to: array of recipient emails
- email_cc: array of cc emails

Respond with JSON only:"""

    ai_data = {}

    # 1. Call Ollama
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0
                }
            },
            timeout=120
        )

        if response.status_code == 200:
            result = response.json()
            ai_output = result.get("response", "").strip()
            if ai_output:
                cleaned_output = clean_json_text(ai_output)
                try:
                    parsed = json.loads(cleaned_output)
                    if isinstance(parsed, dict):
                        ai_data = parsed
                except json.JSONDecodeError:
                    pass

    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please ensure Ollama is running at http://localhost:11434"
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Ollama request timed out"
        )
    except Exception:
        # Fallback to hybrid NLP extractor
        pass

    # 2. Extract and merge using robust NLP & Rule parser
    extracted = extract_proposal_from_raw_text(data.email_text, ai_data)

    return ProposalExtraction(**extracted)