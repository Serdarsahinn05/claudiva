---
name: arayuz-ilkeleri
description: UI design principles - hierarchy, spacing, typography, color, states, responsive.
---

# UI Principles

- **Hierarchy:** One primary action per screen; secondary actions visually recede.
- **Spacing:** Stick to the 4/8px grid; no arbitrary margin values.
- **Typography:** At most 2 font families and 3-4 size steps. Line length ~60-80 characters.
- **Color:** It carries meaning (error=red, success=green, warning=yellow) and comes from one source (theme variables).
- **States:** empty / loading / error / filled - all four are designed. Skeleton > spinner (for long lists).
- **Forms:** Error messages sit next to the field and say what to do ("Enter at least 8 characters", not "Invalid").
- **Responsive:** Horizontal overflow never scrolls the page; tables/code blocks scroll in their own container.
- **Performance:** Virtualize lists of 100+ items; size images; fix needless re-renders with correct state placement before reaching for memo.
