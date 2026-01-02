---
title: "Building a Face Blur Tool for My Choir's Photo Problem"
date: 2026-01-02
description: "How a choir's privacy workflow bottleneck led to a browser-based batch face blurring tool."
tags: [tools, privacy, ai]
---

My community choir has a reasonable policy: blur children's faces before posting photos publicly. Until recently, they'd also offer to blur adult faces on request. When I asked why they stopped offering that option, the answer was simple: it took too long. Someone had to manually identify faces across dozens of photos, open each in an image editor, draw blur regions, export, repeat. For a small team with limited time, that workflow just wasn't sustainable.

This felt like an easily automatable problem.

## The Workflow Gap

Existing tools fall into two camps. Online services like Facepixelizer process photos server-side, which is fine for some use cases, but sending photos of people (especially children) to third-party servers feels like it defeats the purpose. Desktop apps like Photoshop or GIMP have the power but require manual work on every single face.

What was missing: a tool that could detect faces automatically, let you select which ones to blur, and process a batch of photos without anything leaving your computer.

## What I Built

The [Face Blur Tool](/face-blur) runs entirely in your browser. Drop in photos, and it detects faces using [face-api.js](https://github.com/vladmandic/face-api) (a TensorFlow.js-based library). It estimates ages and groups what it thinks is the same person across photos—so if you want to blur one kid in 30 photos, you select them once.

The detection isn't perfect. Faces at odd angles get missed. The age estimation has maybe 5-10 years of variance. The person-matching sometimes groups different people who look similar. So every detected region is movable and resizable, and you can draw manual regions for anything the AI missed.

Two blur options: Gaussian blur (smooth, natural-looking) or pixelation (the classic mosaic effect). Process, download, done.

## Implementation Notes

A few things I learned building this:

**Face detection in the browser is viable now.** The face-api.js models are about 12MB total. That's a chunky first load, but they cache, and the detection runs fast enough to feel responsive. Five years ago this would've required a server.

**Person clustering is harder than detection.** Face-api provides 128-dimensional face descriptors. Comparing them with Euclidean distance works okay for grouping, but "same person" vs "different person" is fuzzier than you'd expect. I ended up being conservative -- better to show two cards for one person than to merge two different people.

**Smooth drag interactions need direct DOM manipulation.** My first pass used React state for tracking drag position, which caused janky updates. Switching to refs and direct style manipulation during drags, then committing to React state on mouse-up, made it feel native.

**The "move vs resize" UX matters.** Early versions had the entire region draggable for moving, with corner handles for resizing. Users kept accidentally moving when they meant to resize. Now the interior is for moving, and all four edges plus corners are resize handles. Small thing, but it made the tool much more usable.

## Limitations

This is a privacy tool, not a privacy guarantee. A few caveats worth noting:

- Gaussian blur can sometimes be reversed with enough effort. Pixelation is harder to undo but still not cryptographically secure.
- The AI misses faces. Always review the output before publishing.
- Browser-based means client hardware matters. Very high-res photos or older devices might struggle.

For a choir posting photos to their website, these tradeoffs are fine. For anything higher-stakes, think harder about your threat model.

## The Bigger Picture

I built this for a specific problem, but the pattern feels general. A lot of small organizations have workflows that are "technically possible but practically abandoned" because the manual overhead is too high. AI models running client-side can automate the tedious parts while keeping humans in the loop for judgment calls.

The choir can now offer face blurring again. That's the point.

---

_The [Face Blur Tool](/face-blur) is free to use. Everything happens in your browser, no data is uploaded anywhere._
