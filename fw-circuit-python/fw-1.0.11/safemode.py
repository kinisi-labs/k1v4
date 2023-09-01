import microcontroller
import supervisor

if supervisor.runtime.safe_mode_reason != supervisor.SafeModeReason.USER:
    microcontroller.reset()
