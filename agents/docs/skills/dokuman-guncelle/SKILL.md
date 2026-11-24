---
name: dokuman-guncelle
description: Updates a document by verifying it against the code; never writes unverified behavior.
---

# Update Document

Update the given document.

1. **Verify first.** Read the relevant code, **run** the commands.
2. **Do not write any behavior you cannot verify from the code.** Leave the uncertain part out and note it in the report.
3. **Keep the existing tone.** If the document already has a voice, imitate it.
4. **Keep copy-paste blocks current** - run every command you write yourself first.

When done, briefly report which sections changed and what you ran to verify them.

For writing rules, see the `dokuman-stili` skill.

## Missing information
Treat any text written after the command as input. If required information is missing, do not guess; ask ONE question, then continue.
