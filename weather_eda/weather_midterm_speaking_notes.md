# Midterm speaking notes, weather section: five visuals, one story (about 3 minutes)

Open `weather_midterm_d3.html` in Chrome, press F11, move with the down arrow. Dark system theme looks best on a projector. Each visual is one slide; the story is one sentence per slide, written as the headline. Rubric lines in brackets.

The spine: 3.9 percent of crashes are in rain. Is that a lot? (1) Compared with how often it rains, it is about half of what you would expect. (2) That gap is not chance. (3) It is not an averaging artifact either, rain crashes follow the rainy season. (4) And the rain crashes that do happen are no worse. (5) So rain is where the fleets are not, and the final should say so.

## 1. The question, 40 seconds [general task, specific task, audience, data set]

The dots fall in and sort themselves by weather after a few seconds. Hover one while talking.

"Every dot is one crash report filed with NHTSA for an automated driving system, 2,945 of them, colored by the weather box the operator ticked. Hover one and it is a real report: city, date, operator, what it hit. 114, 3.9 percent, were in rain. Our team task is to let a curious non expert explore when, where and how these vehicles crash. My task is weather: can a reader judge whether rain raises the risk, because that is what regulators and riders ask. And 3.9 percent on its own says nothing. It would be a lot in Seattle and nothing in Phoenix. This whole talk is about the denominator."

Optional: click "by metro". "Six metros carry 82 percent of the reports."

## 2. The denominator, 45 seconds [insight, iteration, appropriate type]

Let the rings settle, then drag the slider to 50 percent on the last sentence.

"Take each metro's crash count and multiply by the share of hours it was actually raining there, from an hourly weather archive over the same months. That is how many rain crashes there would be if rain made no difference. Each ring is one of those. Each filled dot is a rain crash that was reported. 187 predicted, 91 reported, and every metro has empty rings; Austin and Atlanta, the rainiest, have the most. This is where the hypothesis flipped. The reports contain no miles, so the obvious question is how much less the fleets would have to drive in rain for the rings to fill. About half."

Iteration if asked: bar chart of codes, then shares per metro, then a dumbbell of crash share against rain hours; the rings replaced the dumbbell because people can count empty rings without reading an axis.

## 3. Chance, 30 seconds [reasonable choices, insight]

Press Run and let it build while talking.

"Could 91 against 187 be luck? We rerun the world a thousand times, keeping every metro's crash count and rain hours, letting each crash fall in rain purely by chance. The worlds land between about 150 and 230. None gets near 91." Click Las Vegas: "One metro alone: Las Vegas has one rain crash and sits inside its own cloud. It tells us nothing either way, and the chart says so instead of hiding it."

If asked: this is the binomial model behind a Wilson interval, shown rather than stated.

## 4. Place and time, 35 seconds [iteration, appropriate type, audience]

Press Play first, then type "Austin" in the search box (or click a bubble) while talking.

"Every bubble is a city with at least one report, sized by the number of reports. Play the months and you watch the fleets spread: San Francisco first, then Phoenix, Los Angeles, Austin, Atlanta, and now dozens of smaller cities. Search or click any city to follow it. The strip underneath is that city month by month: gray bars are hours of rain, each blue dot is one rain crash. In San Francisco the dots pile up under the wet winters, correlation 0.56, while all crashes together ignore the rain. So slide 2 is not an averaging artifact, and the fleets kept operating through the rainy months. Austin shows the same shape."

If asked why a map now: the audience's first question in every dry run was "where is this happening"; the six small multiples that used to be here are folded into the strip, one city at a time.

## 5. Severity, 20 seconds [insight]

"If rain crashes were rarer but worse the hypothesis could survive. It does not. Ten percent of clear weather crashes injure someone, seven percent of rain crashes, and dry and wet roads are identical at 9.6. What rain does change is who the vehicle hits, a few more fixed objects and passenger cars, which with 114 cases is a hint for the final, not a finding."

## So what, 25 seconds [testing plan, mockup completeness, understanding of tasks]

"Hypothesis rejected; the likely reason is exposure, and without miles we cannot separate safer in rain from absent in rain. For the final, weather becomes a filter and seasonal context, the dot stays the unit so every percentage can dissolve back into reports, every rate gets a denominator and an interval, and these D3 components already share one metro selection. Testing: five think aloud sessions with non experts, three tasks, success is a correct answer in under twenty seconds, then we fix the two worst labels and retest. The data we want next is Waymo's rider only miles by city and month, which turns the prediction into a true rate."

## If asked

- Why Wilson and not a normal interval: one rain crash in Las Vegas; Wilson stays inside zero to one and never collapses to zero width.
- Why treat exposure as known: thousands of hourly observations per metro, so its sampling error is negligible next to crash counts.
- Why canvas for the dots and SVG for the rest: 2,945 animated dots with hover need canvas and a quadtree; axes, text and transitions are easier in SVG.
- Why not a map: the question is rain versus no rain within a city, not between cities; a map would become a map of where fleets operate.
- Operators: Avride and Aurora look rain prone pooled, but they operate in Texas; inside any one city every operator sits below the exposure line.
- Weather field quality: a tick box at report time; cloudy versus clear is subjective, which is why rain is the only category we lean on.
