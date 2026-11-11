# Should you call a robotaxi in the rain? Storyboard for the Hypothesis 3 final visualization

Solomon, Group 4, DATASCI 209. One scrolling D3 story built on the midterm page. The rider picks a city and a weather once at the top, and every screen follows. Each screen answers one question a rider would ask and ends with one plain sentence. Six screens, about three minutes of reading.

Design rules: the picker is sticky and drives all data; a dot is a crash report wherever a mark can be a dot; every rate shows its denominator; what the data cannot say is said out loud, never hidden; the page is complete at rest, interaction adds depth but is never required to get the point.

Data: NHTSA Standing General Order ADS reports, July 2021 to August 2026, 2,945 crashes after de-duplication (2,272 clear, 538 cloudy, 114 rain); Open-Meteo Historical Weather API hourly precipitation for the six metros with 60+ crashes (San Francisco, Phoenix, Los Angeles, Austin, Atlanta, Las Vegas), turned into the share of hours it rained per metro per month.

What already exists from the midterm page: the dot field, the rings with the slider, the 1,000 worlds simulation, the US map with city search, the injury chart. The final adds the shared state (city and weather), the verdict card, and the methods screen, and rewires the existing beats to the picker.

---

## Screen 1. The hook

Question: It is raining in [city]. Should you still call a robotaxi?

Chart: the city picker and the weather picker (clear, cloudy, rain), then all 2,945 reports as dots that settle into the spiral, colored by the weather on the report. The chosen city's dots are bright, the rest fade; choosing a weather pulls those dots to the front.

Interaction: pick a city and a weather; hover any dot for its report (city, date, operator, severity, weather).

Rider sentence: "Here is every crash a self driving car has reported in the United States. [1,109] are in your city, and [48] of those happened in rain. Let's see what they say about your ride."

Status: built. Needs the picker and the fade and pull behaviors.

## Screen 2. Where the cars crash

Question: Is my city unusual?

Chart: the US map, circle area = reports per city, with the chosen city highlighted and the six metros labeled. A strip below shows each metro's share of rain crashes against its share of rain hours.

Interaction: the city search already on the map becomes the picker; clicking a circle sets the city for the whole page; the play button walks the months.

Rider sentence: "[City] has [3.3] percent of its hours in rain and [1.6] percent of its crashes in rain. Every metro sits below the line; none is above it."

Status: built. Needs the click-to-pick wiring and the rain share strip.

## Screen 3. What rain does

Question: Are rain rides more dangerous?

Chart: the rings for the chosen city. Each ring is a rain crash the weather would predict (crashes times the share of hours it rained there), each filled dot is a rain crash reported. The six-metro view appears when the picker is on "all cities".

Interaction: the slider "how much do you think the fleet drives when it rains?" rescales the prediction so the rider discovers the rings fill at about half; the 1,000 worlds simulation runs as a small inset that shows 91 is never reached by chance.

Rider sentence: "If rain made no difference, [city] should have [94] rain crashes. It reported [48]. Either rain is safer or the cars are mostly not out in it, and the reports cannot tell those apart because nobody reports miles."

Status: built. Needs the inset and the per-city sentence.

## Screen 4. Do the cars even go out in the rain

Question: Or are they just parked when it pours?

Chart: San Francisco by month, two lines on a shared time axis: share of hours with rain, and rain crashes. The correlation of 0.56 appears as a label; the same chart for all crashes (correlation minus 0.13) is one toggle away. For other cities the chart shows their months with a note on how thin the data is.

Interaction: toggle rain crashes versus all crashes; hover a month for rain hours, rain crashes and all crashes.

Rider sentence: "In the wettest months San Francisco reports the most rain crashes, so the cars do drive in rain. They just do not drive as much of it as the weather alone would predict."

Status: Altair version exists in the deck; needs the D3 version.

## Screen 5. How bad it gets

Question: When a robotaxi crashes in the rain, is it worse?

Chart: injury rate with a Wilson interval for clear (10.0 percent of 2,272), cloudy (8.4 percent of 538) and rain (7.0 percent of 114), then the dots sorted into severity columns so the rider sees that about nine in ten reports have no injury.

Interaction: hover for the interval and the counts; the picker filters to the city; a toggle switches from weather to road surface (dry 9.6 percent of 2,826, wet 9.6 percent of 115).

Rider sentence: "About one crash in ten injures anyone. Rain does not change that, though 114 rain crashes is too few to say it is safer."

Status: built. Needs the city filter and the surface toggle.

## Screen 6. The verdict, and how we know

Question: So, should you call the car?

Chart: a card that assembles the sentences from screens 1 to 5 for the chosen city and weather, in plain words, with the one thing the data cannot say stated as plainly as the things it can. Below it, a methods panel: the two data sources with links, the de-duplication, the exposure method, the Wilson intervals, and the list of gaps (no miles in the reports, location redacted below city, weather is a tick box, 114 rain crashes).

Example card, San Francisco in rain: "Nothing in 1,109 reports says a rain ride here is more dangerous than a dry one. Rain crashes run at half of what the weather predicts, and they are no more severe. What the reports do show is that the fleet is mostly not out when it rains, so your real problem may be getting a car at all."

Interaction: changes with the city and weather; a copy button for the card; expandable methods sections; link to the repo.

Status: to do. Sentence templates for six cities times three weathers.

---

## Shared machinery to build once

A single `state` object (city, weather) with a subscribe function that every screen listens to; the picker component rendered once and pinned; the dot field component (canvas, quadtree hover) reused on screens 1 and 5; one color code (amber clear, gray cloudy, blue rain); a `sentence(state)` function per screen so screen 6 can assemble them; one data.json already built for the midterm.

## What the data cannot do, and what we say instead

No miles, so no rate per mile; we show prediction versus reported and name the two explanations. No location below city, so no "which neighborhood is safe"; we answer at the city level and say why. No rain intensity per crash, so no "when it rains super hard"; weather is a tick box on the report. The verdict never says "safe" or "unsafe". It says what the reports show and what they cannot.

## Testing plan

Five think-aloud sessions with non-experts. Three tasks: "Is a rainy ride in Phoenix more dangerous than a dry one?", "Do the cars drive in the rain in San Francisco?", "What is one thing this data cannot tell you?" Success is a correct answer under 20 seconds without help. After round one, rewrite the two worst sentences and retest with two people.

## Sequencing

Step 1: the state object, the picker, and screens 1, 3 and 6 end to end, so the story is complete with the core claim before anything else is added. Step 2: screens 2, 4 and 5 wired to the same state. Step 3: the eighteen verdict templates, the methods panel, testing, fixes.
