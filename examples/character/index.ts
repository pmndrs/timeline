import { action, build, duration, parallel, animationFinished, forever } from '@pmndrs/timeline'

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

async function* WalkRunJumpIdleBehavior() {
  let lastJump = 0
  while (true) {
    yield* action({
      update() {
        return !isGrounded || shouldJump(lastJump)
      },
    })

    let jumped = false

    if (shouldJump(lastJump)) {
      jumped = true
      lastJump = performance.now()
      playAnimation(jumpStartAnimation)
      yield* action({ until: animationFinished(mixer, jumpStartAnimation) })
      playAnimation(jumpUpAnimation)
      applyVelcity([0, 1, 0])
    }

    yield* parallel('race', action({ update: () => !isGrounded }), async function* () {
      if (jumped) {
        yield* action({ until: animationFinished(mixer, jumpUpAnimation) })
      }
      playAnimation(jumpLoopAnimation)
      yield* action({ until: forever() })
    })

    playAnimation(jumpDownAnimation)
    yield* action({ until: duration(50, 'milliseconds') })
  }
}

const update = build(WalkRunJumpIdleBehavior)
