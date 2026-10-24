#!/bin/zsh
# Usage: zsh scripts/set-key.sh GROQ_API_KEY
# Prompts for the value without echoing it and writes it into the repo-root .env (never printed, never committed).
name=$1
env_file="${0:A:h}/../.env"
if [[ -z $name ]]; then echo "usage: zsh scripts/set-key.sh NAME   (e.g. GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY)"; exit 1; fi
read -s "?Paste $name and press Enter: " value; echo
if [[ -z $value ]]; then echo "Nothing pasted; .env unchanged."; exit 1; fi
if grep -q "^$name=" "$env_file"; then
  sed -i '' "s|^$name=.*|$name=$value|" "$env_file"
else
  echo "$name=$value" >> "$env_file"
fi
echo "Saved $name (${#value} characters). Restart the backend to use it."
