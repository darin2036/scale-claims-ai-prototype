# FenderBender Mutual — AI Claims Intake Prototype by Darin LaFramboise

## Overview
This project is a rapid prototype built to demonstrate product thinking, AI‑assisted development, and the ability to translate a vision into a working experience quickly.

The goal was to reimagine the first 5–10 minutes after a car accident — one of the most stressful moments in a customer’s relationship with an insurance company — and design a mobile‑first, AI‑assisted claim intake flow that feels calm, guided, and human. Specifically, I wanted to see how we could leverage AI to really simplify the workflow, make the outcome predicable, and give the person some reassurance during a tough experience.

Instead of a long, form‑heavy process, this prototype focuses on:
- Reducing cognitive load
- Providing reassurance
- Using AI to remove manual work and remove as much of the unknown as possible
- Progressively guiding the user step‑by‑step

The result is a clean, mobile‑friendly web app that helps a customer safely document an incident, assess damage, and begin a claim in minutes.

---

## What I Built

I designed and implemented a front‑end prototype for an AI‑assisted auto insurance claim experience under a fictional brand: **FenderBender Mutual**.

The experience simulates what a modern, AI‑first claims journey could look like if rebuilt from the ground up with heavy leaverage of AI.

Key characteristics:
- Mobile‑first UX for use at the scene of an accident
- Progressive, card‑based flow
- AI‑assisted data capture and summarization
- Smart defaults based on policy + vehicle context
- Calm, reassuring tone throughout the experience

---

## Product Vision

The core product idea behind this prototype is simple:

> In moments of stress, software should guide — not interrogate.

Traditional claims flows feel like paperwork. This experience aims to feel like a supportive assistant.

Design principles:
- Safety first
- Ask less, infer more
- Show only what’s needed next
- Use AI to reduce friction
- Provide reassurance at every step

---

## Core Flow

The app walks a user through a simplified 4‑step journey:

### 1) Safety & Basics
- Safety check‑in at the start
- Confirm drivable status
- Identify if another party is involved
- Vehicle lookup via license plate or VIN

### 2) Photos
- Capture damage and vehicle photos
- AI mock analyzes severity

### 3) Optional Details
- Other driver information (only if relevant)
- AI‑assisted incident description
- Additional notes

### 4) Review & Submit
- AI‑generated summary
- Damage estimate (mock)
- Estimated repair time (mock AI signal)
- Deductible comparison

### Post‑Submission Support
After submission, the app provides immediate next steps:
- Tow request (if vehicle not drivable)
- Ride home options
- Rental car recommendation based on repair duration
- Nearby repair shop suggestions

---

## AI‑Driven Elements (Mocked)

To demonstrate how AI would be integrated, the prototype includes simulated AI behaviors:

- Damage severity assessment from photos
- Incident narration drafted from structured inputs
- Repair cost estimation
- Estimated repair duration
- Rental duration recommendations

These are deterministic mock models designed to show product intent without requiring real backend services.

---

## Technical Approach

This project was built to demonstrate speed, clarity, and iteration using modern tooling and AI‑assisted development.

Stack:
- React
- TypeScript
- Vite
- Tailwind CSS

Development style:
- Rapid prototyping
- Component‑driven architecture
- Frontend‑only simulation of backend and AI services
- Iterative UX refinement

AI coding tools were used to accelerate:
- UI scaffolding
- Flow restructuring
- Feature iteration
- Mock model creation

---

## What This Demonstrates

This prototype highlights:

- Product strategy translated into a working experience
- Ability to simplify complex workflows
- Human‑centered UX thinking
- AI‑native feature design
- Fast execution under constraints

Rather than focusing on technical perfection, the emphasis was on:
- Clarity of vision
- Thoughtful interaction design
- Smart use of AI to remove friction

---

## Running the Project

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

Open the local URL shown in the terminal.

---

## Notes

This is a prototype intended to demonstrate:
- Product thinking
- UX direction
- AI integration concepts

All insurance logic, AI outputs, and data integrations are mocked for demonstration purposes.

---

## Author

Darin LaFramboise

Product leader, builder, and AI‑first systems thinker focused on turning complex workflows into simple, human experiences.
# FenderBender Mutual — AI-Assisted Claims Assessment Prototype

## Overview
This project is a rapid prototype built to demonstrate product thinking, artificial intelligence–assisted development, and the ability to translate a concept into a working experience quickly.

The prototype explores how artificial intelligence can support insurance claims agents in assessing vehicle damage more efficiently and consistently. It focuses on one of the most time-consuming parts of the claims workflow: reviewing damage photos, estimating severity, and generating repair estimates.

Rather than replacing human judgment, the system is designed to assist claims agents by providing a preliminary assessment that they can review, adjust, and approve. The goal is to reduce manual effort, improve consistency, and accelerate the path from image submission to repair authorization.

---

## What I Built

I designed and implemented a front-end prototype for an artificial intelligence–assisted car insurance damage assessment experience under a fictional brand: **FenderBender Mutual**.

The prototype demonstrates two complementary perspectives in the claims process:

- A policyholder experience that captures incident details and damage photos
- A claims agent review experience that uses artificial intelligence to assist with damage interpretation and estimate generation

Together, these flows show how artificial intelligence can support both sides of the process while keeping humans in control of final decisions.

---

## Product Vision

The core product idea behind this prototype is to help claims agents make faster, more consistent damage assessments by introducing artificial intelligence as a decision-support layer.

Today, agents manually review submitted images, interpret damage severity, and estimate repair costs using experience and reference materials. This process can be slow, inconsistent, and mentally demanding.

This prototype demonstrates a future workflow where artificial intelligence provides an initial interpretation of damage and a suggested repair cost range, and the agent reviews, edits, and approves the final outcome.

Design principles:
- Assist, do not replace human judgment
- Reduce time spent on repetitive image interpretation
- Improve consistency across claims
- Keep the agent in control of the final decision
- Use artificial intelligence to structure information, not dictate outcomes

---

## Core Experiences

### Policyholder Flow

The existing flow simulates the first few minutes after an accident. It allows a customer to document an incident, upload photos, and generate a preliminary claim summary.

Key steps:
- Safety check-in and basic incident details
- Photo capture of damage and vehicle
- Optional additional details
- Review and submit with a simulated damage estimate

This flow exists to generate the inputs that a claims agent would later review.

### Claims Agent Review Flow

The agent experience demonstrates the part of the workflow the prototype is designed to improve: manual review and damage assessment.

In this view, a claims agent can:
- Select a submitted claim
- Review vehicle damage photos
- Run an artificial intelligence–generated damage assessment
- See a suggested severity level and repair cost range
- Edit or override the estimate
- Approve and authorize the repair decision (simulated)

This clearly shows the human and artificial intelligence collaboration model. The system provides a starting point, and the agent makes the final call.

---

## Artificial Intelligence Integration (Mocked)

To demonstrate how artificial intelligence would be incorporated, the prototype includes simulated behaviors such as:

- Image-based damage severity assessment
- Detection of impacted areas
- Suggested repair cost ranges
- Confidence signals to guide agent review

These are deterministic mock models designed to illustrate product intent without requiring real backend services.

In a production system, this would be powered by computer vision models trained on labeled vehicle damage images, combined with historical repair cost data.

---

## Human and Artificial Intelligence Interaction

A key design principle in this prototype is that artificial intelligence supports the claims agent rather than replacing them.

The system performs the initial interpretation of damage and suggests a cost range. The agent then reviews the assessment, adjusts estimates if needed, adds notes, and authorizes the repair decision.

Each human correction would serve as training signal data in a real system, gradually improving model accuracy over time.

---

## Technical Approach

This project was built to demonstrate speed, clarity, and iteration using modern tooling and artificial intelligence–assisted development.

Stack:
- React
- TypeScript
- Vite
- Tailwind CSS

Development style:
- Rapid prototyping
- Component-driven architecture
- Frontend-only simulation of backend and artificial intelligence services
- Iterative experience refinement

Artificial intelligence coding tools were used to accelerate:
- User interface scaffolding
- Flow construction
- Feature iteration
- Mock model behavior

---

## What This Demonstrates

This prototype highlights:

- Strong product thinking applied to a focused workflow
- A clear vision for artificial intelligence–assisted claims assessment
- Human-centered experience design
- Thoughtful human and artificial intelligence collaboration
- Fast execution under tight time constraints

The emphasis was on clarity of concept, usability, and demonstrating how artificial intelligence could realistically fit into an existing claims process.

---

## Running the Project

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

Open the local URL shown in the terminal.

---

## Notes

This is a prototype intended to demonstrate:
- Product direction
- Claims workflow improvement
- Artificial intelligence integration concepts

All insurance logic, assessments, and artificial intelligence outputs are simulated for demonstration purposes.

---

## Author

Darin LaFramboise

Product leader focused on simplifying complex workflows and designing artificial intelligence–assisted systems that keep humans at the center of decision-making.