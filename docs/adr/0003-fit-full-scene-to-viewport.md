# Fit the full scene to the viewport

The game should use the browser viewport without hiding browser controls, while keeping the complete scene visible at different screen sizes. We use a 1920×1080 reference scene and scale it proportionally to fit the viewport, centering it over a dark background when aspect ratios differ; this keeps the composition intact without cropping or distortion.
