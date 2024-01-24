from app import cpu_usage

def test_cpu_usage_is_numeric():
    assert isinstance(cpu_usage, (int, float)), "cpu_usage should be a number"
