"""
Delivery Date Notification Scheduler

Runs daily at 8:00 AM to check for projects with upcoming or overdue delivery dates.
Sends notifications to Admin and Group Head when delivery is within 30 days or overdue.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date
from sqlalchemy.orm import Session
from db import SessionLocal
from models.model import Proposal, Notification, Group
from models.user_model import User


def check_delivery_notifications():
    """Check for delivery notifications and create them for admin and GH."""
    db: Session = SessionLocal()
    try:
        today = date.today()

        admin_users = db.query(User).filter(User.role.in_(['admin', 'guest', 'role'])).all()
        admin_names = [u.name for u in admin_users if u and u.name]

        # Get all incomplete proposals (not technically or financially completed)
        proposals = db.query(Proposal).filter(
            Proposal.technical_completed_year.is_(None),
            Proposal.financial_completed_year.is_(None)
        ).all()

        for proposal in proposals:
            # Use extended delivery if present, else delivery date
            delivery_str = proposal.extended_delivery_date or proposal.delivery_date
            if not delivery_str:
                continue

            # Parse date - handle multiple formats
            delivery_date = None
            for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y'):
                try:
                    delivery_date = datetime.strptime(str(delivery_str).strip(), fmt).date()
                    break
                except:
                    continue

            if not delivery_date:
                continue

            days_remaining = (delivery_date - today).days

            # Only notify if within 30 days or overdue
            if days_remaining > 30:
                continue

            # Build notification message
            if days_remaining >= 0:
                message = f"Project {proposal.project_number or proposal.id} - Delivery in {days_remaining} days ({delivery_date.strftime('%d-%m-%Y')})"
            else:
                message = f"Project {proposal.project_number or proposal.id} - Overdue by {abs(days_remaining)} days (was due {delivery_date.strftime('%d-%m-%Y')})"

            # Get recipients - all admin users always get notified
            recipients = list(admin_names)

            # Also notify Group Head if proposal.group is mapped in Groups table
            if proposal.group:
                group = db.query(Group).filter(Group.name == proposal.group).first()
                if group and group.head:
                    recipients.append(group.head)

            # Remove duplicates and blanks
            recipients = [r for r in dict.fromkeys(recipients) if r]

            for recipient in recipients:
                # Avoid duplicate notification for same project same day
                today_start = datetime.combine(today, datetime.min.time())
                existing = db.query(Notification).filter(
                    Notification.related_proposal_id == proposal.id,
                    Notification.user_name == recipient,
                    Notification.created_at >= today_start
                ).first()

                if not existing:
                    notif = Notification(
                        user_name=recipient,
                        message=message,
                        is_read=0,
                        related_proposal_id=proposal.id,
                        trigerred_by='system'
                    )
                    db.add(notif)

        db.commit()
        print(f"[SCHEDULER] Delivery notification check done at {datetime.now()}")

    except Exception as e:
        print(f"[SCHEDULER] Error: {e}")
        db.rollback()
    finally:
        db.close()


# Create scheduler instance
scheduler = BackgroundScheduler()

# Add job to run daily at 8:00 AM
scheduler.add_job(
    check_delivery_notifications,
    trigger='cron',
    hour=8,
    minute=0,
    id='delivery_check',
    name='Delivery Date Notification Check'
)


def start_scheduler():
    """Start the background scheduler."""
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] Background scheduler started")
    else:
        print("[SCHEDULER] Scheduler already running")


def shutdown_scheduler():
    """Shutdown the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        print("[SCHEDULER] Background scheduler stopped")


if __name__ == '__main__':
    # Run immediately when called directly
    check_delivery_notifications()
