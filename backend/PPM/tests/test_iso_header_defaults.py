from iso.header import normalize_centre_dept


def test_normalize_centre_dept_keeps_logged_user_value():
    assert normalize_centre_dept("SMPM") == "C-SMPM"
    assert normalize_centre_dept("C-SMPM") == "C-SMPM"
    assert normalize_centre_dept("  smpm  ") == "C-SMPM"


def test_normalize_centre_dept_does_not_fallback_to_default_center():
    assert normalize_centre_dept("") == ""
    assert normalize_centre_dept(None) == ""
