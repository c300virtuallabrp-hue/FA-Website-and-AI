# README

## Overview
The AI is currently hallucinating the contents of uploaded zip files. Instead of listing the actual files inside the archive, it often invents or omits items. This document explains how to reproduce the issue and verify it yourself.

## Current Issue
- **Symptom:** The AI returns incorrect or fabricated filenames after a zip upload.  
- **Scope:** Affects zip inspection responses across agents routed via Chatbot.js.  
- **Status:** Bug under investigation; this README documents how to test and confirm the behavior.  

## How to Test the Issue Yourself
1. Open **Chatbot.js** and locate the Query function.  
2. Replace the link found there with your **Flowise API** endpoint.  
3. Change the **Groq API** configuration to the one you are using in your environment.  

## Expected vs Actual Behavior
- **Expected:** After uploading a zip file, the AI should list the real filenames and directory structure from the archive.  
- **Actual:** The AI returns a plausible-looking list that does not match the real contents. Filenames may be missing, added, or incorrectly made up.  

## Troubleshooting and Validation Tips
- Log payloads to confirm the files are reaching your Flowise step.  
- Verify the parsing step — if you’re summarizing via LLM without a deterministic parser, hallucination is likely.  
- Extract the zip server-side and pass the explicit file list into the model as structured context.  
- Use strict schemas or validation to constrain responses.  
- Add fallback logic so that if parsing fails, you get a deterministic error message instead of a fabricated list.  

## Notes
This happens because the model fills gaps with plausible guesses when it doesn’t have verified file listings. To fix it, integrate a deterministic zip inspection step (server-side extraction or Flowise node) and feed that list into the prompt as authoritative data.  
