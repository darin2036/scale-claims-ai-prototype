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

### Claims Agent Review Mode
A separate **Claims Agent Review** route (`/agent`) demonstrates the internal handling workflow after customer intake:
- Customer upload/submission appears in an agent queue (with mocked claims)
- Agent runs AI damage assessment (areas, severity, confidence, next step)
- AI suggests a severity-based estimate band
- Agent finalizes repair estimate, adds notes, and authorizes repairs

This view explicitly demonstrates a human‑in‑the‑loop AI workflow: AI provides recommendations, and the claims agent makes final decisions.

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
