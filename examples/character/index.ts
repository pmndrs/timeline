import { action, build, timePassed, animationFinished, forever } from '@pmndrs/timeline'
import { graph } from '@pmndrs/timeline/src/helpers/graph'

const mixer = null as any
const jumpStartAnimation = null as any
const jumpUpAnimation = null as any
const jumpDownAnimation = null as any
const jumpLoopAnimation = null as any
let isGrounded = false

function playAnimation(x: any) {}
function applyVelcity(x: any) {}
function shouldJump(lastJump: number): boolean {
  return false
}

function WalkRunJumpIdleBehavior() {
  let lastJump = 0
  return graph('moving', {
    jumpStart: {
      timeline: async function* () {
        lastJump = performance.now()
        playAnimation(jumpStartAnimation)
        yield* action({ until: animationFinished(mixer, jumpStartAnimation) })
      },
      transitionTo: {
        finally: 'jumpUp',
      },
    },
    jumpUp: {
      timeline: async function* () {
        playAnimation(jumpUpAnimation)
        applyVelcity([0, 1, 0])
        yield* action({ until: animationFinished(mixer, jumpUpAnimation) })
      },
      transitionTo: {
        jumpDown: { when: () => isGrounded },
        finally: 'jumpLoop',
      },
    },
    jumpLoop: {
      timeline: async function* () {
        playAnimation(jumpLoopAnimation)
        await forever()
      },
      transitionTo: {
        jumpDown: { when: () => isGrounded },
      },
    },
    jumpDown: {
      timeline: async function* () {
        playAnimation(jumpDownAnimation)
        yield* action({ until: timePassed(50, 'milliseconds') })
      },
      transitionTo: {
        finally: 'moving',
      },
    },
    moving: {
      timeline: async function* () {},
      transitionTo: {
        jumpStart: { when: () => shouldJump(lastJump) },
        jumpDown: { when: () => !isGrounded },
      },
    },
  })
}

const update = build(WalkRunJumpIdleBehavior)
