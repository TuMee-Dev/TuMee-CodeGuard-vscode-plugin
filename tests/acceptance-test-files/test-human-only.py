# @guard:human:w
def human_only_function():
    """Only humans should modify this"""
    return "sensitive logic"
    
# @guard:ai:r
def ai_readable():
    return "AI can read but not write"