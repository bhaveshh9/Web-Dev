import re

def clean_text(text):

    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)

    # Remove blank lines
    text = re.sub(r'\n+', '\n', text)

    return text.strip()