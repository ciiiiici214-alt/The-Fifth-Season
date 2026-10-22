# Background cleanup

Tool: built-in imagegen. Edit targets: user-supplied forest and winter reference images.

## forest.png

Edit target: attached monochrome snowy forest game art. Make a clean background plate for this exact 2D game. Remove all text, remove the small white-haired person and the four glowing butterfly items, fill those areas seamlessly with the existing forest and snow. Preserve the composition, exact snowy horizontal walkable bank at 77% of image height, stream in bottom quarter, dark huge tree on left, rich painterly fine leaf and bark texture, pale foggy luminous middle-right. No new objects, no text, no UI, no characters, no glowing items. Keep wide landscape framing. Save the result as a project usable image.

## winter.png

Edit this exact grayscale painterly winter valley scene into a clean game background. Remove ONLY the two centered lines of text and seamlessly fill with pale snowy sky. Preserve all composition, distant rounded mountains, blowing snow, textured dark foreground, small solitary traveler at left quarter, atmosphere and all other details. No added elements. No text anywhere. Wide landscape.

## characters.png

Tool: built-in imagegen. Edit target: supplied traveler and white cat character model sheet. Produce a clean transparent sprite atlas preserving the EXACT provided character design, colors, poses, hairstyle, scarf, dark coat, boots and cat appearance. Remove all white speckles and white/black fringing OUTSIDE the silhouettes; keep intentional white hair, white cat and cream scarf fully opaque. Keep all six drawings, arranged precisely in a 3-column 2-row equal-cell grid, no labels, no extra objects. Top row: same traveler idle side pose facing right, traveler walking right pose, traveler back pose. Bottom row: same sitting white cat, walking white cat pose 1, walking white cat pose 2, all facing right. Each traveler fills 90% of its cell height, centered, feet aligned at 95% cell height. Each cat fills 65% cell height with paws at 95% cell height. All six fully within their cells, no overlaps. Actual transparent background. Do not redesign, add outlines, add glow, or change the clothing. Landscape atlas 3 columns by 2 rows.

The returned atlas preserves the original uneven row proportions; the runtime uses measured frame rectangles instead of assuming equal cells.
