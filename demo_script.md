# Bootstrap Demo Script

This is the fastest clean 3-minute story for the turn-in.

The video needs to show:

- what you built
- how you built it
- the problem it addresses

## One-Sentence Framing

"Bootstrap is a workbench for watching two agents earn coordination and capability instead of getting both for free on turn one."

## 0:00 - 0:25 Problem

Show the hero section.

Voiceover:

"Most agent demos give tools to the model immediately. That makes them look powerful, but it hides the interesting question: did coordination actually emerge, or did we just assume it?"

## 0:25 - 0:50 What We Built

Show the main Bootstrap shell and stage ladder.

Voiceover:

"We built Bootstrap Workbench. Two peer agents start with messaging and scratch space only. They have to invent a shared protocol, request actions through a broker, and earn stronger capabilities stage by stage."

## 0:50 - 1:20 How We Built It

Point at the stage ladder, peer section, protocol panel, artifact panel, and trace dock.

Voiceover:

"Under the hood, this is a two-peer loop with a broker, a stage curriculum, protocol tracking, checkpointing, and a live evidence stream. The UI turns those backend signals into something a human can actually follow."

## 1:20 - 2:15 Live Run

Press `Start Bootstrap` or `Resume Bootstrap`.

While the run is active, focus on:

- current objective
- capability pills
- protocol tokens
- event dock

Voiceover:

"Now we can watch whether the agents get their act together. New tokens appear, get adopted by the other peer, and only become stable after repeated use. Broker decisions and capability unlocks stay visible the whole time."

## 2:15 - 2:40 Artifacts + Evidence

Show the artifacts panel and assessment panel.

Voiceover:

"The run leaves behind more than chat output. We get artifacts, protocol state, broker receipts, and assessment scores for collaboration, language, traceability, and autonomy."

## 2:40 - 3:00 Close

Voiceover:

"So the product is not just an agent run. It is a supervision surface for staged multi-agent autonomy, where coordination, capability growth, and evidence stay inspectable."

## Safe Claims

These are safe to say:

- Two peers are real.
- Capability access is stage-gated.
- Protocol state tracks pending, adopted, and stable tokens.
- Bootstrap runs can resume from checkpoint state.
- Artifacts and trace signals are persisted locally.

Avoid saying:

- "secure sandbox" for arbitrary production execution
- "fully autonomous production system"
- "guaranteed intelligence improvement"
- "AGI"
