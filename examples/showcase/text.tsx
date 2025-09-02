import { signal } from '@preact/signals'
import { Container, Root, Text } from '@react-three/uikit'

const content = 'Introducing              @react-three/timeline'

export const TextOpacities = content.split('').map(() => signal(0))
export const TextYOffset = content.split('').map(() => signal(0))

export function RenderText() {
  return (
    <group position={[0, -75, 400]} rotation-x={-Math.PI / 2}>
      <Root flexDirection="row">
        {content.split('').map((char, i) =>
          char === ' ' ? (
            <Container key={i} width={50} />
          ) : (
            <Text
              key={i}
              color="white"
              transformTranslateY={TextYOffset[i]}
              opacity={TextOpacities[i]}
              fontWeight={i > 15 ? 'bold' : 'light'}
              fontSize={1000}
            >
              {char}
            </Text>
          ),
        )}
      </Root>
    </group>
  )
}
