async def recognize_intent(user_input: str) -> str:
    # Placeholder for intent recognition logic
    if "schedule" in user_input.lower():
        return "add_to_calendar"
    return "note" 