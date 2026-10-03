---
title: "Vertical Anamorphic on an FX9, Hail Mary Style"
description: "How Project Hail Mary turned anamorphic glass on its side, and how to rig vertical anamorphic on a Sony FX9: the math, the monitor and the post."
date: 2026-10-03
author: Thrill Wave
cover_image: https://images.unsplash.com/photo-1582996582165-a0fa38015e45?w=1600&h=900&fit=crop&q=80&auto=format
cover_alt: "A cinema camera lens on a wooden table"
categories: [Gear and Tech, Craft]
---

Anamorphic glass was built to make pictures wider. Phones want pictures taller. For years that meant choosing one or the other. Then a big studio movie turned the lens on its side, and suddenly the question got a lot more fun: what happens when you squeeze the frame the other way?

Here's what Project Hail Mary did, the math behind it, and how we rig the same idea on a Sony FX9.

## What Project Hail Mary actually did

Greig Fraser shot Project Hail Mary for directors Phil Lord and Christopher Miller on the ARRI ALEXA 65. He asked ARRI Rental for a custom set of anamorphic lenses that could be [mounted sideways on the camera](https://www.newsshooter.com/2026/03/20/arri-rentals-custom-set-of-anamorphic-lenses-for-project-hail-mary/). The camera stayed level. The glass turned 90 degrees. So the squeeze ran up and down instead of side to side, which stretched the image taller and let them fill the IMAX frame with the whole sensor.

> **1.43:1** the tall IMAX ratio the film uses for its scenes in space. Its scenes on Earth go back to a classic 2.39:1 widescreen.

The side effect is the fun part. Anamorphic flares streak along the squeeze, so sideways glass gives vertical flares and bokeh that stretches the other way from what our eyes expect. Fraser has said the Earth scenes were shot on [Atlas Mercury anamorphics](https://definitionmagazine.com/features/greig-fraser-project-hail-mary/), so the two worlds of the story literally look different through the glass.

| | ARRI ALEXA 65 | Sony FX9 |
|---|---|---|
| Sensor size | 54.12 x 25.58 mm | 35.7 x 18.8 mm |
| Sensor area | about 1,384 mm² | about 671 mm² |
| Photosites | 6560 x 3100 | 6008 x 3168 (6K readout) |
| Body weight | 10.5 kg | about 2.0 kg |

Different leagues, same physics. The trick lives in the lens, not the camera, so it scales all the way down to a body two people can carry up a mountain.

## Three ways to go vertical with anamorphic

There's more than one way to get there, and each one changes the shape of the frame and the direction of the flares. The rule is simple: the squeeze multiplies whichever side of the sensor it runs along. These numbers are for a 16:9 sensor area, our math.

| Rig | What you turn | 1.33x | 1.5x | 2x | Flares in the final frame |
|---|---|---|---|---|---|
| Classic | Nothing | 2.37:1 | 2.67:1 | 3.56:1 | Horizontal |
| A | Camera and lens together | 9:21.3 tall | 9:24 tall | 9:32 tall | Vertical |
| B | Camera only, lens stays level | 3:4 | about 5:6 | 1.125:1 | Horizontal |
| Hail Mary | Lens only, camera stays level | 1.34:1 | 1.19:1 | 0.89:1 | Vertical |

Rig A is the one most people try first: put the whole rig on its side and you get a very tall frame with flares running top to bottom. Rig B is what Atlas calls [AtlasScope](https://www.newsshooter.com/2025/07/08/atlasscope-vertical-anamorphic/): turn the camera, keep the lens level, and you get the classic horizontal streaks inside a vertical frame. The Hail Mary rig is Rig B's twin, just shot for a landscape screen.

Whichever you choose, a phone wants 9:16, so you'll crop. How much you keep depends only on the squeeze.

![Bar chart: when cropping to 9:16 you keep 75 percent of the frame at 1.33x squeeze, 66.7 percent at 1.5x and 50 percent at 2x](/images/blog/vertical-anamorphic-sony-fx9-project-hail-mary/sensor-kept-for-9x16.svg)
*Share of the frame left after cropping to 9:16 (Rig A or B). It's 1 divided by the squeeze. Our math.*

That's why we like 1.33x and 1.5x glass for vertical. A 2x lens throws away half your picture before anyone sees it.

## Setting up the FX9

The FX9 is a great body for this: a full-frame sensor, a built-in variable ND from 2 to 7 stops, and dual base ISO at 800 and 4000. Sony added anamorphic de-squeeze in [firmware 3.0](https://sony-cinematography.com/articles/fx9-version-3-firmware-update-feature-deep-dive/), with a couple of catches worth knowing before the shoot day.

| Setting | What to know |
|---|---|
| Scan mode | Full-frame 6K gives the most sensor to crop from. Record UHD for a true 16:9 area. |
| 1.3x de-squeeze | Works in FF 6K, FF 5K crop and S35 4K. |
| 2x de-squeeze | FF 6K only, and it punches in about 30% to hide vignetting from Super 35 lenses. |
| Where it shows | The camera's own LCD only. SDI, HDMI and the recording stay squeezed. |
| Menu | Monitoring, VF Setting, De-Squeeze. |

Here's the catch for vertical: the FX9 only de-squeezes side to side, in its own screen. That's fine for Rig A, where the lens turns with the camera. For Rig B or the Hail Mary rig, the squeeze runs the other way across the sensor, so the built-in view is wrong. Use an external monitor turned 90 degrees with a custom de-squeeze set to the inverse of your lens.

> **0.75x** the monitor setting for a 1.33x lens squeezing the "wrong" way. Use 0.67x for 1.5x and 0.5x for 2x, as [Blazar's vertical guide](https://blazarlens.com/blog/how-to-shoot-vertiscope-the-complete-guide-to-vertical-anamorphic-filmmaking/) lays out.

![A cinema lens resting on a metal camera cage](https://images.unsplash.com/photo-1623556995300-249c5fc3c552?w=1600&h=1000&fit=crop&q=80&auto=format)
*Rig it like you mean it. Photo: Laura Nyhuis on [Unsplash](https://unsplash.com/photos/a-camera-lens-sitting-on-top-of-a-metal-cage-tndN9mqRWm4).*

## Rigging: weight goes sideways too

Turning things 90 degrees moves the weight off the center of the mount, and anamorphic glass is heavy. Support the lens, not just the mount, and balance the rig again after every turn.

| Piece | Squeeze | Weight |
|---|---|---|
| Sony FX9 body | | about 2.0 kg |
| Atlas Mercury 42mm (full frame, T2.2, 95mm front) | 1.5x | about 1.1 kg |
| Angénieux Optimo Anamorphic 56–152 A2S (T4, 114mm front) | 2x | 2.2 kg |

A few things we've learned the hard way:

- Not every lens can be mounted sideways. Some designs, like [Blazar's Vertiscope approach](https://www.newsshooter.com/2025/12/05/blazar-vertiscope/), turn the front anamorphic element instead. Ask your rental house before you build a plan around it.
- The Angénieux A2S zooms cover a Super 35 sized frame, which pairs naturally with the FX9's 2x mode and its built-in crop.
- On a sideways rig, the follow focus and matte box move too. Build it on the bench, not on location at golden hour.

## In the edit

Post is where vertical anamorphic either clicks or confuses everyone, so we label every clip with its rig before it leaves set.

1. **DaVinci Resolve:** set the squeeze in Clip Attributes (Pixel Aspect Ratio) or Project Settings, rotate in the Inspector, and cut on a 2160 x 3840 vertical timeline.
2. **Premiere Pro:** Interpret Footage covers 1.33x and 2x. For 1.5x, unlink scale and set the width by hand. Then rotate and drop it on a 2160 x 3840 sequence.
3. **Rig A footage** de-squeezes along the long side of the sensor. **Rig B and Hail Mary footage** de-squeeze along the short side. Get that backwards and everyone looks like a funhouse mirror.

## Why bother

A tall frame changes what you can say. A standing person fills it top to bottom. A tower, a rocket or a canyon wall gets its full height. Project Hail Mary used that height to make space feel enormous. On a phone, the same idea lets a single face hold the whole screen, with the soft, stretched character of anamorphic glass around it.

It's a small rotation with a big change in feeling, and that's our favorite kind of filmmaking problem. If you want to see how we shoot, the [portfolio](/portfolio) is a good place to start.

*Cover photo: Jason Leung on [Unsplash](https://unsplash.com/photos/black-camera-lens-on-brown-wooden-table-buwxTB45Xlw).*

## Sources

- [ARRI Rental's custom anamorphic lenses for Project Hail Mary](https://www.newsshooter.com/2026/03/20/arri-rentals-custom-set-of-anamorphic-lenses-for-project-hail-mary/), Newsshooter
- [Greig Fraser on Project Hail Mary](https://definitionmagazine.com/features/greig-fraser-project-hail-mary/), Definition
- [April 2026 issue: Project Hail Mary](https://theasc.com/news/april-2026-issue-american-cinematographer/), American Cinematographer
- [ALEXA 65 specifications](https://www.arrirental.com/en/cameras/digital-65-mm-cameras/alexa-65), ARRI Rental
- [PXW-FX9 specifications](https://pro.sony/en_MM/pdf/pxw-fx9), Sony
- [FX9 version 3 firmware deep dive](https://sony-cinematography.com/articles/fx9-version-3-firmware-update-feature-deep-dive/), Sony Cinematography
- [AtlasScope vertical anamorphic](https://www.newsshooter.com/2025/07/08/atlasscope-vertical-anamorphic/), Newsshooter
- [How to shoot Vertiscope](https://blazarlens.com/blog/how-to-shoot-vertiscope-the-complete-guide-to-vertical-anamorphic-filmmaking/), Blazar
- [Atlas Mercury 1.5x anamorphic lenses](https://www.provideocoalition.com/atlas-lens-co-launches-new-mercury-line-of-1-5x-anamorphic-lenses/), ProVideo Coalition
- [Optimo Anamorphic 56–152 A2S](https://www.angenieux.com/lenses/legacy-series/optimo-anamorphic-56-152-a2s-compact-lens-zoom/), Angénieux
