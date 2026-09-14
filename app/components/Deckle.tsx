/**
 * Deckle filters for card edges.
 *
 * Turbulence displaces the sheet layer only, never the type, so the paper edge wavers
 * the way a cut sheet does while the text stays still.
 *
 * A filter beats an image mask here because card height follows its content: a raster
 * mask would have to stretch to fit, and stretching changes the fibre scale — the same
 * problem tiling was used to avoid on the paper texture.
 *
 * Five seeds is plenty for a deck. Nobody compares the edges of two clippings.
 */
export const DECKLE_COUNT = 5

export function DeckleDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {Array.from({ length: DECKLE_COUNT }, (_, i) => (
          <filter key={i} id={`deckle-${i}`} x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.045"
              numOctaves={3}
              seed={i * 37 + 5}
              result="fibre"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="fibre"
              scale={5}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  )
}
