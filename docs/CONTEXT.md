# Roofing Project Context, Design, and Logic

Nov 18, 2026 · @Hanne

## Design rules

These rules come from the notes in the Week 9 and Week 10 wireframes and from what we decided while building components. Every hi-fi screen should follow them.

### Modes

- There are two modes: Drive Mode and Operate Mode.
- Drive Mode is only for driving fast to a destination. The machine must be fully stowed.
- Wire guidance is for driving to locations, not for lifting. Get into Drive Mode, turn on wire guidance, then the machine drives itself.
- In Operate Mode the boom moves freely and driving is slowed down. No driving while the outriggers are deployed.
- The machine can glide along the wire in Operate Mode, but at reduced speed.
- The truck's wheels are multi-directional. It can drive forwards, backwards and side to side.
- On the wire, the truck is always parallel with the roof's ledge. The wire won't let it connect until it is parallel. More detail on how the truck and boom move is coming from the industrial designer.
- The Ascend to ledge and Descend to ground buttons work in both modes.
- Bring to ledge only works when the machine is near the ledge. If the machine is on the wire, it disconnects.

### Toasts

- Every message is a toast. It is 1280 x 200 and sits at the bottom of the screen.
- Action (teal, with a button) means the operator must approve something.
- Step (teal) gives a heads up. Step used to be called Info.
- Loading (teal stripes, animated) means the machine is busy and the operator can keep working.
- Success (green) means it worked and the operator can continue.
- Warning (amber) means a limit is close. Danger (red) means the machine stopped and the operator must act. Danger can show the physical button to press.
- Warning and Danger always come with a sound and lights.
- Each toast has a Content option:
  1. Message: one line in Field/Heading/Section.
  2. Title + message: a Field/Heading/Page title with the Field/Heading/Section message under it.
  3. Title: just the Field/Heading/Page title.
- Title and Message are shared text fields. The text stays when you switch a toast's Type or Content.

  Toast timing: all toasts show for about 1.5 seconds, then hide. The exception is any toast the operator must respond to, like an Action toast with Allow or Cancel, which stays until tapped. Lasting state is carried by the map, chips, badges and LMI lights, and sounds back up the toasts. If an alert (Warning or Danger) pops up during a move, it covers the move's Loading toast for as long as it shows, then the Loading toast comes back.

  Any toast can show a picture on the right (Show picture + Picture, 240 x 152). The picture is the Toast picture frame component set to Floating, with an Illustration inside it. Danger toasts use this slot for the LMI button instead of a built-in picture.

  Illustration rules (Illustration component, Line style):
  - Six pictures: LMI button, Switch deploy, Switch retract, Outriggers deploying, Outriggers retracting, Tablet unlock.
  - Outline style, viewed straight on, with 4px lines in text-secondary.
  - One accent color per picture, plus neutral fills. Teal for the outriggers, green for the lit switch, red for the LMI button.
  - The hand is the hand-pointer icon from the icon set, with a white fill so it sits in front of what it presses.
  - Motion is shown with thin arrows. Presses are shown with short press marks around the button.
  - The switch pictures have a Glow toggle. Glow on shows the green backlight. The outrigger toasts use Glow on.
  - Where each one is used: LMI button on the LMI at limit toasts, Switch deploy and Switch retract on the flip-the-switch toasts, Outriggers deploying and retracting on the loading toasts, Tablet unlock on the "Press and hold the unlock button" toast in the dismounted flow.
  - The old Toast picture components were retired. Use only the Illustration set for new pictures.

### LMI

- LMI % is the main safety number. Keep the name "LMI" because it is the industry standard.
- The light stack fills from the bottom: levels 1 to 2 green, 3 to 4 amber, 5 to 6 red.
- Close to the limit: Warning toast and sound. The operator moves to a safer position, then sees a Success toast.
- At the limit: the machine stops. A Danger toast and sound show the physical LMI button. The operator presses and holds it, and the machine moves itself to a safer position. Controls stay locked until it finishes.

  As LMI rises, the map tints the zones where LMI would be too high: feedback-warning at 30% with a warning line when approaching, feedback-error at 30% at the limit. The tint sits inside the roof clipping group.\
\
At the limit, after the operator holds the LMI button and the sensing sound plays, an Action toast asks "Machine will begin reconfiguring. Allow?" The machine only moves after Allow.\
\
From the moment the machine stops at the limit until the move is done, the map is covered by the Map lock overlay labeled "Movement locked", and + and − are disabled. While the machine moves itself, a side view shows it (placeholder: the Side view · Cab close-up component on a card, warning outline) until the side view panel is designed.

### Outriggers

- Outriggers deploy and retract based on LMI %, but the operator always flips the switch.
- The cab has a green backlit switch for the outriggers. Toasts show a picture of it when the operator needs to use it.
- To deploy: after the boom extends past a certain point, the machine stops. A toast says to deploy the outriggers, with a sound and the switch picture. The operator flips the switch, the outriggers deploy, and a Success toast says to continue.
- To retract: if a move needs driving while the outriggers are down, the machine stops. A toast says the outriggers must be retracted, with a sound and the switch picture. The operator flips the switch, and a Success toast says to continue.

  The flip-the-switch toasts show the Switch deploy or Switch retract picture with Glow on, and the deploying and retracting toasts show the outriggers moving. From the moment the machine stops until the outriggers finish moving, the map is covered by the Map lock overlay labeled "Movement locked", and + and − are disabled.

### Quick pick remote

- The quick pick is a Bluetooth remote. It only pairs when the machine is connected to the wire.
- With it, the operator can move the cab and creep the truck along the wire from the roof.

### Touch and screen

- Use big tap targets, not drag and drop. Operators wear thick gloves.
- Buttons are at least 64px tall with at least 8px between them.
- Pick a spot uses big squares the operator taps.
- The side view only shows while the cab is moving, so the operator can see when it touches the roof.
- The machine senses the roof angle by itself. The operator does not adjust for it.
- No footer on any screen.

* Every screen is 1280 x 832.

### Side view

- The side view only shows while the cab is moving. It goes away when the cab stops.
- The machine already knows the roof angle and drives up it by itself. This works when the operator moves the cab and when they use Pick a spot. The operator never adjusts for the angle.
- So the side view is not for steering. Its only job is to show the operator whether the machine is touching the roof or not.
- It shows the roof slope, the cab and boom, and the path the cab follows along the roof angle.
- The side view uses the Side view · Cab close-up component: a clean line drawing in text-secondary with an outline around the cab.
- The cab outline is interactive-action normally and feedback-warning when the operator needs to pay attention.
- The boom has 4 angles: Base, 10° lower, 20° lower and 30° lower. The cab stays level and only the arm swings.
- The side view panel design itself is still in the backlog.

### Operate Mode screen states

- Base: status bar, LMI light stack, machine view and load badge.
- Wire connected: same as base, plus the wire badge next to the battery turns success green and the green wire line shows around the roof.
- Moving: same as base, plus the side view. The side view design is in the backlog for now.

### Machine view (Operate Mode)

- The machine view is a top-down map of the roof with the machine on it.
- The roof is a 3D render, clipped to the roof outline with a gray edge. The render is a placeholder for a real roof scan.
- A white grid splits the roof into zones. Each big zone splits into 4 by 4 small zones.
- There are 3 zoom levels:
  1. Zone map: the whole roof with big zones only.
  2. Zooming in: big zones get bigger and faint small zones start to show. Small zones can be picked here, the same as fully zoomed in.
  3. Zoomed in: small zones. All grid lines are the same width (2px), so big zone lines don't stand out here. They only stand out on the zone map and the middle zoom.
- The operator zooms with the teal + and − buttons in the top right, or by pinching. There is no map button. Each tap moves one zoom level, and the map zooms smoothly (300ms, ease out). At the limits the button turns gray and does nothing: − on the zone map, + when fully zoomed in. This uses the new Button Type=Icon, State=Disabled variant. In the simulator, a trackpad pinch or a mouse scroll over the map steps one zoom level the same way, and is locked whenever + and − are. Dragging pans the map at every zoom level, including inside a drilled-in big zone, and on the Drive screen map (the truck icon moves with it). The Drive screen map has no zoom levels, so a pinch or scroll there zooms it smoothly around the truck, and the zoom stays while driving. It also has the teal + and − buttons in the top right (each tap zooms 1.5 times in or out, gray at the limits and while the map is locked). The Tilt badge moved to the bottom right. The map comes back to the truck when you zoom or a move starts, and on the Drive screen as soon as the truck moves.

  The cab zone uses the Cab zone component. Its Zoom option matches the zoom level, and Fill is always Soft (50%).
- The Cab zone component marks the zone the cab is in: the big zone on the zone map, and the small zone at the middle zoom and when zoomed in (the same kind of zone that can be picked there). It shows on and off the wire. It is success green, always Soft (50%) on screens.
- The machine uses the Machine · Aerial component, filled with the primary teal. It has Extended and Folded states. The boom can be Center, Left 25, Left 45, Right 25, Right 45 or Center extended. The truck stays in the same spot for every boom option.
- The Truck location ring component has a Type option. Type=Truck marks where the truck is now, with one size per zoom level: 70px, 155px and 300px. Type=Destination marks where the truck will stop on the wire in Pick a spot. It has one look at every zoom level, including the route view: a big success green dot with a white edge and a soft green halo (120px).
- Zones never go past the roof. Edge zones are clipped to the roof outline, so they can be smaller than a full square. A clipped zone smaller than half a full zone is not its own zone. It merges into the neighbor it shares the longest edge with, and the grid line between them is removed. This works the same for big zones on the zone map and small zones when zoomed in. A highlight on a merged zone covers the whole merged shape. Picked zone highlights, the cab zone and grid lines all sit inside the roof's clipping group.
- Whenever the truck is hidden, a Truck indicator pops up to show where it is. Hidden means the center of the truck is off screen or behind a toast. If a toast hides it, the indicator sits 16px above the toast, lined up with the truck and pointing Down. If that would cover the machine, it moves beside the machine and points at the truck at an angle (Down-left or Down-right). If the truck is off screen, the indicator sits at the map edge on the truck's side, clear of the + and − buttons and the load badge. It is a pill with an arrow and the word "Truck" in interactive-focus, with 8 Direction options.
- The picked zone uses the Selected zone component. Tapped is a teal outline (6px, interactive-action) with a 20% teal fill. Confirming is solid teal with the same outline.
- Wire connected: a success green line runs around the roof. On zoomed-in screens, a soft success green band (25%) sits under it. The band is 80px wide fully zoomed in and about 42px at the middle zoom. The wire runs exactly 16px outside the roof ledge, parallel to it everywhere. Its path has rounded corners (40px fully zoomed in, scaled down at other zooms), so the line stays centered in the band around every turn. The zone map has no band.
- Wire not connected: zoomed-in screens and the Operate and Drive base screens show the wire in border-control gray, with no band.

### Pick a spot and the wire

- On the wire, zone map: the operator can use Pick a spot to send the machine to any big zone. The machine drives there along the wire.
- On the wire, Drive screen: tapping a spot on (or near, about a finger's width) the wire picks that spot, the same way. This includes the branch out to the materials. The green destination dot shows on the wire, then the Allow toast ("Machine will drive to new spot. Allow?"), then the joystick, the route on the map (solid behind, dotted ahead, the rest of the wire gray) and "Arrived." The truck drives there folded and stops; nothing rises.
- On the wire, zoomed in: the operator can pick a small zone. If the boom can reach it from where the truck is, only the boom moves. If not, and it is inside the big zone the cab is already in, the machine slides along the wire without folding, then the boom adjusts so the cab sits in the picked zone. If it is in a different big zone, the machine folds, drives along the wire until the truck lines up with the spot, then unfolds and telescopes the boom to reach it.
- Not on the wire, zone map: the operator can't use Pick a spot. Only the boom moves, so the machine can't drive itself to other big zones.
- Not on the wire, zoomed in: the operator can use Pick a spot, but only the boom moves. It angles left or right, or telescopes straight out, to reach small zones within reach. The truck never moves.
- The zones set when the machine folds. A small zone inside the cab's current big zone is a short move, so there is no folding. A small zone in a different big zone, or any big zone picked on the zone map, means the machine folds first so it can drive, if it is raised. If it is already folded on the ground, it skips folding and drives right away. The exception: if the boom can reach the picked zone by telescoping or angling without moving the truck, only the boom moves and there is no fold, even across a big zone line. The turret turns 180 degrees, 90 each way from forward, so on the wire the boom can swing sideways too: a small zone the boom can reach from where the truck is gets a boom-only move (angling and telescoping), and the truck only slides along the wire when the zone is out of reach. Off the wire, the boom angles or telescopes because the truck can't move. Moves where only the boom moves never fold.
- In every Pick a spot flow, the picked zone stays Selected zone, Tapped while the Allow toast shows. It changes to Confirming only after the operator presses Allow, and stays Confirming until the move is done.
- A big zone move ends with the machine still folded at the stop point; it does not rise. A small zone move ends with the cab in the picked zone. If the machine drove there folded, it rises at the end: Loading toast "Rising to the ledge...", and the cab rises into the picked zone while the operator holds the joystick forward. Then the cab zone moves there and the Success toast shows.
- Allow toast wording depends on the move. If the truck drives, it says "Machine will drive to new spot. Allow?" If only the boom moves, it says "Machine will configure to new spot. Allow?"
- From the moment the operator presses Allow until the move is done, the + and − buttons are locked (Button, State=Disabled). The map zooms on its own to show the move. Before Allow, zooming in or out leaves the picked zone and goes back to the normal map at that zoom level. The one exception: with a big zone tapped on the zone map, + zooms straight into that big zone so the operator can pick a small zone inside it, and − from there goes back to the zone map with the big zone still tapped.

### Pick a spot screens

On the wire, zone map (big zones):

1. Tap a big zone. It shows as Selected zone, Tapped (teal outline, 20% fill). The green destination dot appears on the wire next to it.
2. Allow? Action toast: "Machine will drive to new spot. Allow?" The zone stays Selected zone, Tapped. It changes to Confirming once the operator presses Allow.
3. Machine descending (only if the machine is raised). The machine folds before it drives. If it is already folded on the ground, this step is skipped. Loading toast: "Machine descending..."
4. Driving along the wire. The machine stays folded. Loading toast: "Machine driving to new placement..."
5. Arrived. The machine stays folded at the stop point (it does not rise), and the cab zone moves to the new zone. Success toast, title "Arrived." with the message "Done configuring."

Route display after Allow:

- The map zooms in so it shows just the route: the start, the path and the destination. It fits above the toast and left of the buttons.
- The wire the truck already drove is solid success green, with a green dot where it started.
- The wire still ahead is dotted success green, ending at the green destination dot.
- The rest of the wire, not on the route, is action-disabled.
- On Arrived, the map zooms back out to the full zone map.

On the wire, zoomed in (small zones):

1. Tap a small zone (Tapped).
2. Allow? Action toast: "Machine will drive to new spot. Allow?" The zone stays Tapped, then changes to Confirming once the operator presses Allow.
3. Driving along the wire. The whole machine slides along the wire without folding. Loading toast: "Machine driving to new placement..."
4. Configuring. The boom adjusts so the cab sits in the picked zone. Loading toast: "Configuring machine to new placement..."
5. Arrived. The cab zone moves to the picked zone. Success toast: "Done configuring."

On the wire, zoomed in, small zone in another big zone:

1. Start, zoomed in. The green cab zone shows where the cab is now.
2. Tap a small zone in a different big zone. It shows as Selected zone, Tapped. A big green dot appears on the wire where the truck will stop, lined up under the spot. This is the Destination ring component, Type=Destination, Zoom=Zoomed in.
3. Allow? The zone stays Selected zone, Tapped. Action toast: "Machine will drive to new spot. Allow?" Once the operator presses Allow, the zone changes to Confirming.
4. Machine descending. The map zooms out to the middle zoom so the whole route shows. The machine folds. The route ahead is dotted success green, and the rest of the wire is action-disabled. Loading toast: "Machine descending..."
5. Driving along the wire. The driven part of the route is solid green, with a green dot where it started. Loading toast: "Machine driving to new placement..."
6. Arrived. The map zooms back in. The machine unfolds, and the cab zone moves to where the cab is now. Loading toast stays.
7. Done. The boom telescopes (Boom = Center extended) so the cab sits in the picked zone, and the cab zone moves there. Success toast: "Done configuring."

On the wire, tap a big zone, zoom in, pick a small zone:

1. Tap a big zone on the zone map. It shows as Selected zone, Tapped, with the green destination dot on the wire.
2. The Allow toast shows. The operator can press Allow to send the machine to the big zone, or press + instead.
3. Pressing + closes the toast and jumps straight to full zoom, centered on the tapped big zone. The big zone is outlined in interactive-action (6px), clipped to the roof edge, and the rest of the map is dimmed with a 60% white layer. The truck is off screen here, so a Truck indicator (Direction=Down-left) sits at the bottom left edge of the map, above the load badge. Only small zones inside the big zone can be picked.
4. Tap a small zone inside it. It shows as Selected zone, Tapped. The big green destination dot appears on the wire, level with the small zone.
5. Allow? Action toast: "Machine will drive to new spot. Allow?" The zone changes to Confirming once Allow is pressed.
6. Machine descending. The map zooms out to show the route, and the machine folds. Loading toast: "Machine descending..."
7. Driving along the wire to the stop point. Loading toast: "Machine driving to new placement..."
8. Arrived. The map zooms back into the big zone without the dim layer. The machine unfolds with the boom pointing into the roof, and the cab zone moves to where the cab is.
9. Done. The boom telescopes into the picked small zone and the cab zone moves there. Success toast: "Done configuring."

On the wire, zoomed in (boom telescoping):

1. Zoomed in. The green cab zone shows where the cab is now. The wire is success green with its highlight band.
2. Pull and drag to pan the map so the zone above the cab shows.
3. Tap a small zone the boom can reach by telescoping straight out. It shows as Selected zone, Tapped. No destination dot, because the truck does not move.
4. Allow. Action toast: "Machine will configure to new spot. Allow?" The zone changes to Confirming once Allow is pressed.
5. Configuring. The boom telescopes straight out with no fold, and the truck stays on the wire. Loading toast: "Configuring machine to new placement..."
6. Done. Boom = Center extended, and the cab zone moves to the picked zone. Success toast: "Done configuring."

Not on the wire, zoomed in (boom angling left and right):

1. Tap a small zone the boom can reach, then Allow.
2. Configuring. The zone changes to Confirming and the boom starts swinging toward it. The truck does not move. Loading toast: "Configuring machine to new placement..." Then the boom finishes the swing.
3. Arrived. The cab zone moves. Success toast.

Not on the wire, zoomed in (boom telescoping):

1. Zoomed in. The green cab zone shows where the cab is now.
2. Pull and drag to pan the map. The roof, wire, truck and machine all move together.
3. Tap a small zone the boom can reach by telescoping straight out. It shows as Selected zone, Tapped.
4. Allow. Action toast: "Machine will configure to new spot. Allow?"
5. Configuring. The zone switches to Selected zone, Confirming. The boom telescopes straight out and the truck does not move. Loading toast: "Configuring machine to new placement..."
6. Done. The machine uses Boom = Center extended. The cab sits in the picked zone, and the green cab zone moves there. Success toast: "Done configuring."

### Dismounted HMI tablet

- The HMI tablet can be taken off the truck so the operator can use Pick a spot from somewhere else, like the roof.
- The tablet can only come off when the truck is connected to the wire. If it isn't, the physical latch stays locked. The map dims behind a Map lock overlay labeled "Latched to truck", and a Step toast says to connect to the wire first. Once the wire connects, a Success toast says the latch is released.
- Once removed, the status bar shows a teal "Dismounted" pill (Status bar, Dismounted = on) for as long as the tablet is off the truck.
- A removed tablet starts locked. The map dims behind the Map lock overlay labeled "Locked", + and − are disabled, and a Step toast says to unlock to use Pick a spot.
- Unlocking is either a PIN or a physical button. The method isn't decided yet, so both are designed:
- Option A, PIN: the PIN keypad component sits in the middle of the dimmed map. Keys are 104 x 72 with 12px gaps for gloves, and the dots fill in as digits are entered.
- Option B, button: the Tablet unlock button drawing shows where the button is, and a Step toast says to press and hold it.
- After unlocking, a Success toast says "Unlocked". The operator then gets the normal machine view: zoom with + and − or pinch, drag to pan, and pick a big or small zone. The LMI stack and load badge stay visible for safety. Moves work like the Pick a spot flows above, with one difference: the operator is up on the roof, so the cab comes to them. A small zone works the same (the boom reaches into it, sliding or driving first if it's out of reach). A big zone folds the machine and drives it right under the zone, then the cab rises into the big zone, at the small zone on its edge nearest the truck (Loading toast "Rising to the ledge..."). On the cab tablet, a big zone move still ends folded at the stop point.

Screens (in the "Pick a Spot - Dismounted HMI tablet" section):

1. Not on the wire: the operator tries to remove the tablet, but it's latched. Then the wire connects and the latch is released.
2. On the wire: tablet removed and locked, then unlock (2a PIN or 2b button), unlocked, tap a big zone, Allow, machine descending, driving along the wire, done. Every screen shows the Dismounted pill.

### LMI and outrigger screens

In the "LMI Flows" and "Outrigger Flows" sections. They all use the zoomed-in machine view.

1. LMI approaching limit: operating (LMI 2) → LMI rising, risky zones tint amber (LMI 3) → Warning toast with sound and lights (LMI 4) → back to a safe zone, Success toast (LMI 2).
2. LMI at limit: machine stops with the boom out, risky zones tint red, Danger toast with the LMI button picture (LMI 6) → sensing balance while the button is held → Allow? → machine reconfiguring with the side view placeholder → done, lights stop.
3. Outriggers deploy: machine stops, Warning toast with the switch picture → deploying → Success.
4. Outriggers retract: machine stops when the operator tries to drive, Warning toast with the switch picture → retracting → Success.

Pictures go inside the toast, on the right, in the Floating frame (the Toast Picture slot). A picture on a card on the map was also tried and dropped.

### Drive mode and speed alerts

These live in four sections: "Drive Mode", "Overweight Load Flows", "Uneven Ground / Steep Slope Flows" (Drive mode, Operate mode and Ground to avoid) and "Object Detection Flows" (heat map). Restricted speed means creep speed. The truck has three speeds: creep, slow and fast.

- Drive mode is the ground view while the truck is folded and driving. It uses the same layout as Operate mode. The Tilt badge sits top right in place of + and −, since there are no zones to pick while driving. (In the simulator, the Drive map also has + and −, and the Tilt badge sits bottom right on both screens, mirroring the Load badge on the left and moving up above a toast the same way. On the Operate screen it still only shows while the ground is uneven.) Trees are simple gray circles so the ground reads differently from the roof.
- Restrictions that last a while use two things together: a Warning toast when the restriction starts, and a Status chip in the status bar that stays until the cause clears. The chips are Creep speed (snail icon) and Boom restricted (boom-lift icon, a custom icon modeled on the side view cab close-up: cab with a window, a bent knuckle boom and forks, drawn on the same 24px grid and 2px round stroke as the icon set). When the cause clears, a Success toast says what is back and the chips go away.
- Boom restricted means boom movement is limited, not locked. The map stays usable and there is no Movement locked overlay.
- Overweight load: when the forks pick up a load over the limit, the Load badge turns amber and shows the max under the weight. A Warning toast says "Load is over the limit. Speed is reduced to creep until the load is lighter." The Creep speed chip stays on until the load is back within the limit.
- Uneven ground or steep slope: the Tilt badge turns amber and shows the angle. A Warning toast explains it, and both the Boom restricted and Creep speed chips stay on until the ground is level. This works in Drive mode and Operate mode. In Operate mode the Tilt badge only shows while tilt is a problem, under + and −.
- The 1,000 LB max and 9° tilt values are placeholders until the industrial designer confirms real limits.

### Ascend and descend (in progress)

Still being worked out. These notes come from the "ascend and descend physical button flows" frame.

- Ascend ("bring to ledge") and Descend ("retract machine") work in both Drive and Operate mode, and they follow the same rules.
- The physical control may be a button, a switch or something else. That is not decided yet. Pressing it is the confirmation, so there is no Allow toast.
- After the press, the HMI tells the operator to push the joystick forward. The machine only moves while the joystick is held forward.
- If the operator lets go of the joystick, the machine stops and the HMI asks if they want to cancel. When ascending, canceling sends the cab back down to where it started. When retracting, canceling stops the machine right where it is and gives the operator full manual control of the joysticks.
- The machine senses the ledge and its height. If the truck is not near enough, the HMI tells the operator to drive closer and shows where the ledge is and how far away it is.
- Ascending works on or off the wire. If the truck is on the wire, it stays connected.
- After ascending, the screen switches to Operate mode.
- Outriggers are not part of ascend. If the operator extends the boom after reaching the ledge and the LMI goes past a set point (about the 4th light), the outrigger flow starts.
- Ascend warns instead of blocking. Uneven ground, an overweight load or an object near or above the cab show a Warning toast that explains the risk, and the operator can still push the joystick to continue. LMI at limit keeps its own flow that stops the machine. Retract stays available during high LMI, overweight load and uneven ground, since retracting is how the operator gets back to a safe position. It only stops for something in its path, like an object under the cab. If any problem starts while the cab is moving, the cab stops and asks to cancel, the same as letting go of the joystick. The machine senses objects above it (eaves, branches, power lines) as well as around it. Warning screens are in the "Ascend & Retract Warnings" section.
- Fully retract goes in this order: the boom folds, then the cab lowers, then the outriggers retract last so the machine stays stable the longest. It works while the forks are carrying a load. After retracting, the screen switches to Drive mode.
- How to show the rise: a side view panel with the cab moving up toward a dashed ledge line labeled with its height, a live height readout, and a Step toast with a joystick picture. Still open: whether Movement locked shows while the cab moves, and what kind of physical control it is.

Ascend screens (in the "Ascend to Ledge Flow" section):

1. Too far from the ledge: the ledge is highlighted in teal on the Drive mode view with a dashed line and an "8 ft away" pill. Warning toast: "Drive closer to the ledge."
2. Ready: the truck is next to the ledge. A Cab height panel opens top left with a side view, a dashed "Ledge · 14 ft" line and a "0 ft of 14 ft" readout. Step toast with the new Joystick forward picture: "Push the joystick forward. The cab will rise 14 ft to the ledge."
3. Rising: the cab moves up in the panel and the readout counts up. Loading toast: "Rising to the ledge..."
4. Joystick released: the cab stops. Action toast: "Machine stopped. Push the joystick to keep rising, or cancel to go back down." with a Cancel button.
5. Canceled: the cab goes back down. Loading toast: "Going back down..."
6. At the ledge: the cab floor lines up with the ledge line. Success toast: "At the ledge. Switching to Operate mode."

Retract screens (in the "Retract Machine Flow" section). They start in Operate mode on the wire and use the same Cab height panel, with the ground as the teal target and a "Step x of 3" label:

1. Press: Step toast with the Joystick forward picture: "Push the joystick forward. The boom will fold and the cab will lower. Then you will flip the outrigger switch."
2. Folding the boom: Loading toast "Folding the boom... Step 1 of 3".
3. Lowering the cab: the truck on the map switches to the folded view. Loading toast "Lowering the cab... Step 2 of 3".
4. Retract outriggers: matches the Outrigger retract flow. The machine pauses, the Movement locked overlay covers the map, + and − are disabled, and a Warning toast with the Switch retract picture says "Retract outriggers. Flip the switch to retract before operation continues." Sound, and the switch is backlit green.
5. Retracting outriggers: Movement locked stays on. Loading toast "Retracting outriggers..." with the Outriggers retracting picture.
6. Successfully retracted: Movement locked clears. Success toast "Successfully retracted. Switching to Drive mode." with a sound.

The Cab height panel stays on top of the Movement locked overlay so the operator can still read the cab height.

Branch, joystick let go during step 3: (3a) Action toast "Machine stopped. Push the joystick to keep retracting, or cancel to take full control." with Cancel, then (3b) Step toast "Retract canceled. The machine stopped here. You have full control of the joysticks."

### Inaccessible roof areas

Screens are in the "Inaccessible Roof Areas" section.

- A drone scan of the house and its surroundings happens before the job. An AI uses it to decide how each obstacle affects reach. (More detail on the drone scan to come.)
- No access: if an obstacle would make the truck park more than about 30 ft from the house (like a garden bed), or the ground on that side is too steep to drive, those roof zones are No access. They are covered with a 72% white layer and gray diagonal hatching.
- Limited reach: if the truck can still get close but its base is pushed out (like a row of bushes against the house), reach is reduced. Those zones get a light 30% white layer and lighter hatching.
- Obstacles from the scan show on the ground beside the roof in the object detection style: gray lumpy shapes with a soft shadow. The map does not explain what each obstacle is. Two kinds look different on purpose. Small obstacles (like bushes) are gray lumps. Hatching only means a disabled roof zone, so no-go ground has its own look by type. Flat no-go ground (like a garden) is a soft solid gray amorphous shape with a dashed edge and a light dot texture. A steep slope is a 3D terrain map: stacked elevation layers that get lighter toward the peak, with thin contour lines, soft shadows and a top-left highlight. No-go ground can spread past the edge of the map, since it is part of the real surroundings. This lets the map show hill vs garden without labels.
- Wire around obstacles: the wire goes around bushes in a squared-off detour, matching the rest of the wire. While the truck is on the detour, reach is reduced because the base is pushed out.
- Disabled wire: where an obstacle blocks a whole side (like a garden), the wire is disabled there. It is shown as a gap with no line (version B). A dashed gray line (version A) was tried and dropped.
- Tapping a No access zone shows a Step toast: "Can't reach this area. This area can't be reached due to obstacles." Nothing else happens.
- Tapping a Limited zone works like any Pick a spot move, with an Action toast that adds why: "Machine will drive to new spot. Allow? Reach is limited here. The truck has to park farther from the house."

### Wire, material run, power and idle (planned)

From the "Design now 2" frame. Order: wire acquiring, then the material run, then power on/off and the roof scenario.

Wire acquiring (screens in the "Wire Acquiring Flow" section):

- The operator can only connect in Drive mode, but once connected the wire works in Drive and Operate mode. In the simulator the wire isn't drawn in the 3D world: it's still there along the same path (around the house and out the branch to the materials), the truck still connects to it and rides it, and the HMI maps still show it.
- A physical wire button starts it. Searching means the machine is looking for the wire. Acquiring means it found the wire and is connecting. The wire is not physical. It is drawn on the map to match wire guidance convention.
- Wire states on the map: available (faint gray dashed line), searching (teal dashed), acquiring (green dashed), connected (solid green line with the green band). The status bar wire icon turns green when connected.

1. Near the house: the wire shows as a faint gray dashed line. When the truck drives near the house, a sound plays and a Step toast says "Wire nearby. Press the wire button to connect to the wire." Nothing happens until the operator presses the physical wire button.
2. Button pressed: the truck lines up next to the wire. Loading toast "Searching for the wire..."
3. Acquiring: Loading toast "Connecting to the wire..."
4. Acquired: Success toast "Connected to the wire. Use Pick a spot to drive to any spot along the wire." with a sound.
5. Connected: a Roof overview card opens top left with the whole wire around the house and a dot for the truck.

Still open: what happens if it can't connect, and the disconnect flow.

Material run (screens in the "Material Run Flow" section):

- The material location is set beforehand in other software, so it is already on the map near the house. It is a tappable Material spot (an 80px round pin with a 44px package icon, no label), connected to the house wire by a short wire branch. It stays Selected until Allow, like zones.
-
- The run starts from the Operate zone map or the Drive screen map: the operator taps the Material spot there, like a zone. The truck stays folded the whole way. While the run is going, W is its joystick, so it doesn't also drive the truck by hand.

1. On the wire: the Material spot shows on the ground left of the house.
2. Tap the Material spot: it turns teal. Action toast "Machine will drive to materials. Allow?" After Allow, a Loading toast with the joystick picture says "Push the joystick forward to move."
3. Driving: the route along the wire to the Material spot is shown dotted. Loading toast "Machine driving to new placement...". The truck is behind the toast, so the Truck indicator shows above it.
4. Arrived: the truck is at the Material spot. Success toast "Arrived at materials." with a sound, for 1.5 s.
5. Loading: the operator loads the forks by hand with the joysticks. The Load badge updates (800 LB). 5a. Load too heavy: if the load is over the limit, the Overweight load flow starts (amber Load badge, Creep speed chip, Warning toast).
6. Going back: the operator picks a spot on the roof (Action toast "Machine will drive to new spot. Allow?"), then the normal Pick a spot and Ascend flows run. The truck does not remember its last roof spot.

- A path is the wire. The truck rides any path the same way it rides the wire around the house.
- Common automated paths that skip parts of the house are out of scope for now.
- Material run: materials are always on the ground. A wire path connects the material spot to the main roof, since the truck drives it many times. The operator uses Pick a spot to send the truck to the material location.
- Pick a spot with the joystick (reference flow with the release branch in "Pick a Spot with Joystick · On Wire (big zones)". Rolled out to all Pick a spot flows on and off the wire and the material run: each has an "After Allow · Push the joystick" screen, and every Loading toast shows the joystick picture. The dismounted tablet flows are unchanged):
  - Tap a zone, tap Allow, then a Loading toast with the Joystick forward picture says "Push the joystick forward to move." The operator holds the joystick forward for the whole move: descending, driving the wire, ascending and any boom angling or telescoping. It is always forward, no matter which way the machine is going. Every Loading toast during the move ("Push the joystick forward to move.", "Machine descending...", "Machine driving to new placement...") shows the Joystick forward picture, as a reminder to keep holding it.
  - Why: the point is that the operator does not have to think much. On a regular boom lift the operator flips a switch for each part of the machine and keeps track of every angle and telescope while also worrying about stability and the destination. Here the mental model is just "I want to move forward," and the machine moves forward to the spot.
  - Letting go of the joystick stops the machine. An Action toast says "Machine stopped. Push the joystick to keep moving, or cancel to take full control." Canceling stops the machine right where it is and gives the operator full manual control.
  - When a move finishes, a joystick still held from it does nothing. The operator lets go first, and the next push works as normal manual control. This keeps the cab (or truck) from carrying on past the spot. It applies to every joystick move: Pick a spot, the material run, Ascend and Retract.
  - Dismounted tablet: no joystick, so Pick a spot stays tap Allow and go.
- Power on, idle and off (cab tablet, screens in the "Power On, Idle and Off" section):
  1. Screen turns on: the map is covered by the Map lock overlay with the PIN keypad. One shared password for the machine.
  2. Start-up check: a card lists Outriggers and LMI, each with a spinner while checking and a green check when OK. Loading toast "Running start-up check..."
  3. Passed: both checks show OK and a Step toast says "Start-up check passed." The screen stays for about a second.
  4. The machine starts on its own and goes to the main screen. Success toast "Machine started. You are in Drive mode." with a sound. There is no Start press.
  5. Idle: after a few minutes without movement the machine goes idle on its own. The map dims, an "Idle" chip (moon icon, neutral) shows in the status bar, and a Step toast says "Machine is idle. Touch the screen or move a joystick to wake it."
  6. Awake: touching the screen or moving a joystick wakes it. No password.
  7. Turning off: pressing the same physical Start button turns the machine off. Loading toast "Turning off...", then the screen goes dark.

  In the simulator: it starts off with the screen dark. P (the Start button) or a tap on the dark screen turns the screen on, and P turns the machine off. While it's off and the operator is in the cab, a prompt under the tablet says "P · Tap the screen or press P to turn on the truck". The idle time is 60 seconds without the machine moving, and the machine doesn't go idle in the middle of a flow. Until the machine is on, only getting in or out (4) works. If it was turned off with the cab up, it starts in Operate mode and the toast says so.

  Still open: what happens if a start-up check fails, and whether there is a manual way to go idle.
- Idle vs off: both are safe because the machine locks in place. Idle resumes faster but uses battery, for when the truck will move again soon. Off is for when it will stay put for a while. Idle can be set manually or automatically (how is still open).
- Tablet latch: the tablet can be removed when the truck is on the wire or when the cab is at the ledge (after Ascend).

  Truck at the roof (screens in "Truck at the Roof: Tablet Taken or Left"):
  - 1a, tablet taken, machine off: the machine was turned off with the physical button. The dismounted tablet shows the map under the dim overlay with a large square teal power button (220px, power icon) and the message "Start machine" under it. Starting the machine from the roof is allowed. Tapping it opens the PIN keypad, then the start-up check runs. Because the tablet is away from the cab, Start is on screen: Action toast "Start-up check passed. Start the machine from here?" with a Start button. Then "Machine started. Pick a spot to move the machine." Pick a spot on the tablet is tap Allow and go.
  - 1b, tablet taken, machine idle: the map dims with the Dismounted and Idle chips, and a toast says "Machine is idle. Touch the screen to wake it." One touch wakes it, then Pick a spot.
- 2, tablet left in the cab: the operator turns the machine off with the physical button and it locks in place. The screen is dark. To resume, they get back in the cab and run the normal Power on flow. No warning when leaving without the tablet, and no special "machine off" screen.
- Back burner: an automation to park and rest the truck at the end of the day.

### Visual system

- Use only the Field text styles: Be Vietnam Pro for words and headings, and Roboto Mono for numbers. Space Grotesk was dropped (polish pass 2) so the screen uses two fonts.
- Teal (primary) is for actions and for the operator's own machine and truck ring. It is also used for the picked zone.
- Success green (#428015) means connected or here. It is used for the wire line, the wire badge, the cab zone, the route, the destination dot, Success toasts and the safe LMI lights.
- Red and amber are only for warnings.
- Border-control gray means the wire is not connected.
- Action-disabled means the part of the wire that is not on the current route.
- Start every screen from the Operate Mode or Drive Mode template.
- Map look (direction B4): the roof photo at 55% opacity so it sits behind the UI, 2px grid lines when zoomed in, the 80px wire band with rounded corners, and LMI off lights as neutral outlines.
- Toast placement (polish pass 2): toasts sit inside the map, not full width. They line up with the map's left and right edges and its bottom, with 8px bottom corners. This keeps the whole LMI light stack visible during every alert.
- Load badge with a toast: when a toast shows, the load badge slides up so its bottom sits 16px above the toast. It never hides behind a toast.
- Toast colors: Action, Step and Loading toasts use interactive-action (teal) for the top bar, including the Loading toast's striped bar, and a white (surface-canvas) background with text-primary titles. Orange is only for Warning, red for Danger and green for Success.
- Card style: anything that floats over the map or sits beside it (load badge, PIN dialog, LMI light stack, zoom buttons) uses 12px corners, the Elevation/Card shadow, and a 1px border-divider border. The zoom buttons skip the border.
- Toast titles stay on one line now that toasts sit inside the map. Keep Action titles to about 42 characters.
- PIN keypad: Clear and Unlock use Field/Heading/Section (24px) so the labels have room inside the keys.
- Toast shadow: every toast uses the Elevation/Toast shadow style, a soft shadow that points up and lifts the toast off the map. An outline, a map backdrop, and outline plus shadow were also tried. The backdrop was dropped because it dims the load badge and double-dims screens that already show Movement locked.
- Visual QA before a screen is done: every layer on whole pixels; gaps, padding and corners tied to the spacing and radius tokens (4, 8, 12, 16, 24, 32, 48 and 4, 8, 16, full); UI colors tied to variables; text uses a Field text style; components used as instances with no leftover overrides except size, position, text and visibility; layers that animate between screens have matching names.

## Prototype

Starting points: "Pick a spot · Wire connected", "Pick a spot · Not on wire", "LMI", "Outriggers · Deploy" and "Outriggers · Retract".

- LMI runs as one straight line: operating → LMI rising → warning → back to a safe zone → at limit → sensing → Allow → reconfiguring → done, then it fades back to operating. Warning and safe-zone screens wait 3s; the others 2s.
- In the LMI and outrigger prototypes, tapping anywhere stands in for the physical actions (pressing and holding the LMI button, flipping the outrigger switch). Allow is a real tap on the toast button.
- Each outrigger flow loops: flip switch (tap anywhere) → deploying or retracting (2s) → success (3s) → back to the start.

* The Pick a spot prototype is wired frame to frame. Start it from "Pick a spot · Wire connected" or "Pick a spot · Not on wire".
* The zoom screens are the hubs. The operator zooms with + and − (Smart Animate, 300ms, ease out) and taps a zone at the right zoom level to start a path.
* After a tap, the Allow toast slides in after 0.6s. Loading screens move on by themselves after 2s.
* Done fades back to the hub the flow started from, so testers can try another path.
* On the zoomed-in hubs, dragging the map pans into the telescoping flows.
* Layers that should animate between screens need matching names. Grid lines are named by where they sit on the roof (for example "Grid col +1").

File layout (High Fidelity page): the left column has Operate Mode, Pick a spot feature flows and Alerts (LMI, outriggers). The right column has Drive Mode, Alerts (overweight load, uneven ground, object detection, ascend and retract warnings), Machine Movement (joystick Pick a spot, Ascend, Retract), Site and Wire (wire acquiring, material run, inaccessible roof areas) and Power (power on, idle and off, truck at the roof).

New flow starting points (smart animate, 300ms ease out). Screens with an Action or Step toast, or no toast, advance on a tap anywhere, standing in for the button, joystick or touch. Loading and Success screens advance on their own after 2 seconds.

- Wire acquiring
- Material run (the Load too heavy branch is a static screen)
- Pick a spot with joystick, plus "Joystick released → cancel"
- Ascend to the ledge, plus "Ascend: joystick released → cancel"
- Retract the machine, plus "Retract: joystick released → cancel"
- Power on, idle and off
- Roof: tablet taken, machine off
- Roof: tablet taken, machine idle

The Ascend & Retract Warnings, Inaccessible Roof Areas and Drive mode alert screens are static states, not prototyped.

## Toast copy table

There are 38 toasts across the Week 10 flows. The wording is copied from your wireframes. The last column only shows typo fixes or small changes to make the wording match. Edit any cell directly.

| Flow | Type | Wording in wireframes | Suggested edit | Sound and lights | Operator does |
| --- | --- | --- | --- | --- | --- |
| Wire guidance | Loading | Searching.... | Searching for wire... | None | Waits |
| Wire guidance | Loading | Acquiring Wire.... | Acquiring wire... | None | Waits |
| Wire guidance | Success | Aquired | Wire acquired. | None | Picks a destination |
| Wire guidance | Step | Tap location along green line. |  | None | Taps a spot on the map |
| Wire guidance | Step | Drag truck to desired location. | Remove. Goes against the tap only rule | None |  |
| Wire guidance | Loading | Driving |  | None | Rides along |
| Wire guidance | Success | Arrived |  | None | Continues |
| Ascend to ledge | Loading | Machine Ascending... | Machine ascending... | None | Waits |
| Pick a spot (boom-only moves) | Action | Machine will configure to new spot. Allow? |  | None | Taps Allow |
| Pick a spot (on wire, small zone in another big zone) | Action | Machine will drive to new spot. Allow? | New wording for moves where the machine drives | None | Taps Allow |
| Pick a spot (on wire, big zone) | Loading | Machine descending... |  | None | Waits |
| Pick a spot | Loading | Configuring machine to new placement... |  | None | Waits |
| Pick a spot (moves where the truck drives) | Loading | Machine driving to new placement... | New wording for the driving step | None | Waits |
| Pick a spot | Success | Done configuring. |  | None | Continues |
| Pick a spot (not on wire, zone map) | Step | Pick a spot needs the wire. Zoom in to move the boom instead. | Approved | None | Zooms in |
| Deploy outriggers | Warning | Deploy outriggers. Flip switch to deploy before operation continues. |  | Sound + switch picture | Flips the switch |
| Deploy outriggers | Loading | Deploying out riggers... | Deploying outriggers... | None | Waits |
| Deploy outriggers | Success | Successfully deployed. Continue operation. |  | None | Continues |
| Retract outriggers | Warning | Retract outriggers. Flip switch to retract before operation continues | Add a period at the end | Sound + switch picture | Flips the switch |
| Retract outriggers | Loading | Retracting outriggers... |  | None | Waits |
| Retract outriggers | Success | Successfully retracted. Continue operation. |  | None | Continues |
| LMI approaching | Warning | Warning: LMI approaching limit. If extended further, you may reach LMI limit. |  | Sound + lights | Moves to a safer position |
| LMI approaching | Success | LMI is back to a safe zone. Continue operating. |  | None | Continues |
| LMI at limit | Action | Machine will begin reconfiguring. Allow? | Added back | Sound when sensing is done | Taps Allow |
| LMI at limit | Danger | LMI % at hazardous level. Press and hold LMI button to return to a safer position. |  | Sound + lights | Presses and holds the LMI button |
| LMI at limit | Loading | Sensing machine balance... Continue to press and hold button until sound. |  | Sound when done | Keeps holding |
| LMI at limit | Loading | Machine reconfiguring ... | Machine reconfiguring... | None | Waits |
| LMI at limit | Success | Done configuring, Machine is now ready to operate. | Done configuring. Machine is ready to operate. | None | Continues |
| Quick pick | Loading | Connecting bluetooth quick pick to machine | Connecting quick pick... | None | Waits |
| Dismounted tablet | Step | Tablet is latched. Connect to the wire before you remove the tablet. | New | None | Connects to the wire |
| Dismounted tablet | Success | Latch released. You can remove the tablet now. | New | None | Removes the tablet |
| Dismounted tablet | Step | Tablet removed. Unlock to use Pick a spot. | New | None | Unlocks |
| Dismounted tablet (button option) | Step | Press and hold the unlock button. It is on the top edge of the tablet. | New | None | Presses and holds the button |
| Dismounted tablet | Success | Unlocked. Pick a spot to move the machine. | New | None | Picks a spot |
| Overweight load | Warning | Load is over the limit. Speed is reduced to creep until the load is lighter. | New | Sound + amber Load badge + Creep speed chip | Removes weight |
| Load within limit | Success | Load is within the limit. Normal speed is back. | New | Chip clears | None |
| Uneven ground / steep slope | Warning | Ground is too steep. (Operate: Ground is uneven.) Boom movement and speed are restricted until the ground is level. | New | Sound + amber Tilt badge + Boom restricted and Creep speed chips | Moves to level ground |
| Ground level again | Success | Ground is level. Boom movement and normal speed are back. | New | Chips clear | None |

Not included: the "You are at risk of tipping" toast, which you parked under Maybe I'll design later.

## Coded prototype (future)

The plan is to code this into an interactive site. You drive the truck yourself, use every HMI feature, and run into every alert as it happens. Nothing here is designed yet. These notes capture the direction so the Figma work lines up with it.

- Goal: one playable demo that covers driving, operating on the roof, Pick a spot, the dismounted tablet, and all alert flows (LMI, outriggers, overweight load, boom while driving fast, uneven ground, object detection).
- 3D environment: the machine view becomes a 3D scene, like the wireframes or the Tesla 3D driving view. The truck, house, roof, trees and ground are 3D, and the camera follows the truck. In the simulator, the world is a warm autumn, toned down: golden grass with a faint triangle pattern and a few tufts, a hazy blue sky fading to a warm horizon, a warm afternoon sun, and soft stepped (toy-like) shading on the ground, plants and house. Round autumn trees and pines frame the edges of the site (decoration only), with a few flower clumps near the house. The bushes and posts are the same obstacles as before, restyled. The house has warm walls, a shingled terracotta red roof whose faces shade clearly lighter or darker by which way they face the sun, trimmed windows and a door. The house also has windows on every side, faint siding lines, white corner trim, a fascia board and gutters along the roof edge, downspouts, a foundation strip, a small porch at the front door and a garage door. On the roof there is a chimney and two round vents (like the Figma roof render). They are obstacles: the cab can't rest on them or move into them, Pick a spot says "Something on the roof is in the way." for a small zone with one in it, and the operator walks around them. The truck keeps its own look. The HMI pieces stay 2D on top of the scene: status bar, LMI light stack, chips, badges, toasts and buttons.
- Password in the simulator: the password is 1117. To keep the demo quick, tapping Unlock without entering it also works as a bypass.
- 3D ground: in general the ground should look 3D, so the operator can see divots, dips and slopes in the terrain around the house. This is planned for the coded version, built from the drone scan. The Figma screens only hint at it: flat ground stays plain, and the steep slope uses a 3D terrain map style as a stand-in.
- Object proximity heat map: objects near the truck light up on the side that faces the truck. The glow gets bigger and hotter the closer the truck gets, going from light amber to orange to deep red-orange. It works together with the Object detection alert and the Creep speed chip.
- Ground to avoid: parts of the ground that are too steep or uneven are highlighted in orange on the ground, so the operator can steer around them before the Uneven ground alert fires.
- Color meaning carries over: orange means warning and red means danger, so the heat map should only reach red when contact is close enough to be a Danger-level event.
- Figma stays the source of truth for the 2D HMI states, components and copy. The 3D scene replaces the flat roof render and ground drawings in code.

### Simulator plan

Simulator screen layout ("Simulator Screen" section under the Simulator header, 1920 x 1080): the 3D view fills the screen (placeholder for now). A mode chip sits top left (Drive mode, Operate mode, Forks, Walking). The HMI shows in a tablet frame on the right, about 40% of the screen width (768 px at 1920), when the operator is in the truck or holding the tablet, and closes when they walk without it. The Controls panel (new Keycap and Controls panel components) sits bottom left. Open, it is a two-column card: mode keys 1 to 4 on the left (current mode teal), and only the keys for the current mode on the right (Drive, Operate, Forks or Walking). Folded, it is a small pill. K shows or hides it. Context prompts float over the 3D view: a keycap plus text for actions like "L Pick up load", and an amber warning for blocked actions like "Get to the roof or ground."

From the "Ideas and steps for machine simulator/video game" frame.

**Step 1: build the 3D map.** A complex 3D site with obstacles for the machine to move through:

- A steep slope where part of the wire is inaccessible.
- A resource (material) location with two loads to pick from: an overweight load and a normal load. The overweight one is there to trigger the Overweight load flow.
- The house, the same one used in the prototypes, built in 3D.
- Bushes and other obstacles around the house.

**Step 2: the moving parts.**

- Operator: walks around. A Smiski-style figure (Figma "Operator references"): about 1.6 m tall with a big round head, tiny dot eyes and a small frowny mouth, a short soft body and stubby arms and legs, pale yellow-green with a faint glow, and a plain green hard hat (no symbol). The legs step and arms swing while walking. The operator also stands in the cab while driving and operating, and rides up with it. With the dismounted tablet, they carry it in both hands.
- Crew (Hanne): two roofers work on the roof and a foreman walks the ground, all the time. They use the same Smiski figure as the operator: roofers in orange hard hats with a hammer, the foreman in a white hard hat with a clipboard. Each roofer works one part of the roof: walks to a spot, kneels and hammers for a few seconds, then moves on, staying clear of the edge, the chimney and the vents. The foreman walks a slow loop around the house, stopping at the corners to look up at the roof. They step aside when the machine comes close (roofers from the cab, about 3.5 m; the foreman from the truck, about 4 m, steering around it). The foreman counts for object detection like a bush or post (heat glow, "Object detected.", creep speed, and the truck can't drive through him). Still to design in Figma: showing people on the HMI map, and whether they get their own alert wording.
- Machine/truck: drives and lifts. References will come from the industrial designer. In the simulator, the whole long rounded housing is the turnstile: it sits on a turntable ring on the chassis and turns with the boom, 90 degrees each way. Turned sideways, it sticks out a little past the sides. The lower boom hinges low at the back end of the housing, and when folded the boom lies in a channel along the housing's top.

**Step 3: design the simulator screen.**

- A view of the environment, with the machine driving.
- The HMI plays on the side of the screen when the operator is on the truck or using the detached HMI tablet. When the operator is off the truck without the tablet, the HMI view closes.
- The HMI can be used with the mouse.
- A foldable keyboard key panel that shows which key does what.

**Step 4: keyboard controls (QWERTY).**

- 1 = Drive mode, 2 = Operate mode, 3 = Fork operation.
- Drive mode: WASD drives the truck forward, backward and side to side, relative to the way the truck faces. Q and E turn it left and right in place. Tab steps through the three speeds (creep, slow, fast), and a speed chip next to the mode chip shows the current one.
- Operate mode: WASD moves the cab forward, backward and side to side. Up and down arrows move the cab up and down.
- Fork operation: up and down arrows move the forks up and down. W extends the forks out, S retracts them.
- Loads: forks are hard to control in a game, so to pick up or drop off a load the player presses L when near one. An "L" prompt shows when they are close enough.
- H detaches the HMI tablet from the machine. In the simulator, H in the truck takes the tablet off or puts it back. Off the wire, H shows the latch (Map lock "Latched to truck") until the wire connects or H is pressed again. A removed tablet starts locked, and the PIN keypad shows once the "Tablet removed" toast hides, or sooner on a tap. A wrong PIN clears the dots. The simulator uses the PIN option. Walking (4) with the tablet keeps the HMI open, and getting back in clips it back on. The tablet also comes off with the cab at the roof, so the operator can carry it onto the roof.
- 4 gets the operator out of the machine. If the machine is raised and not over the roof, getting out is blocked and a message says "Get to the roof or ground."
- Out of the machine, the operator walks with WASD. On the roof, the edges have an invisible force field so the operator cannot fall off. In the simulator, the cab is at the roof when its floor is level with the roof right beside it (at the ledge after Ascend, or resting on the roof after Pick a spot), and not while it is still moving. A "4 Step onto the roof" prompt shows then. The operator steps out beside the cab, walks up and down the roof slopes, and can't walk through the cab. To get back in, they walk up to the cab and press 4, which puts them in Operate mode. On the roof with the dismounted tablet, the outrigger switch (O) works too, so a move that stops to ask for the outriggers can carry on, and the Controls panel lists it under Walking keys.

**Proposed extra keys (in the Controls panel, not final): W = hold joystick forward during Pick a spot, Ascend and Retract (holding W feels like pushing the joystick forward), P = Start button, G = wire button, 9 = Ascend to ledge, 0 = Descend (retract machine), B = LMI button, O = outrigger switch, K = show or hide the Controls panel. Pick a spot and wire guidance stay in the HMI (mouse). Earlier open items:** the joystick-forward hold used in Pick a spot, Ascend and Retract (W could be the natural fit); the physical controls (Start button, wire button, LMI button, outrigger switch, Ascend and Retract controls); and wire guidance and Pick a spot, which may live in the HMI only (mouse).

Open items for the build:

- Which 3D approach to use (for example three.js or React Three Fiber).
- How close counts as "close" for the heat map steps, and whether those steps match the Object detection alert distance.
- Whether alerts fire from real distance and tilt in the simulation, or from scripted triggers.
- A first 2D direction for both is in Figma, in the Object Detection Flows and Uneven Ground / Steep Slope Flows sections. Heat map: the objects themselves light up on the side facing the truck, based on the "object proximity heat map" reference. The closer an object is, the bigger and hotter its glow: gray when out of range, then light amber, then orange when the Object detection alert fires, and a deep red-orange edge for the optional Danger step that stops the machine. Each object is judged on its own distance, so several can glow at once at different strengths. The glow starts at 180px from the truck's edge. Objects are drawn as lumpy bush clusters (trees) and small round posts, like the reference. In the flow, the bush stays put and the truck drives sideways toward it, since the wheels are multi-directional. A glow on the side of the truck facing the object (like car parking sensors) was tried and dropped. Ground to avoid: an amorphous, uneven see-through orange shape with a dashed orange edge, drawn under objects since it is part of the ground, shown ahead of or beside the truck, and under it when the Uneven ground alert fires.

## Open questions

These came up while pulling the table together. Answer them before converting the matching flow.

- [ ] Side view (backlogged): is touching the roof bad, like a collision, or sometimes expected, like landing?
- [ ] Quick pick can't pair when the machine is off the wire. What should that toast say? Draft: "Quick pick can't connect. Connect to wire first."
- [ ] Wire guidance: after the wire is acquired, does the screen switch to the map on its own, or does the operator choose?
- [ ] When the boom telescopes out, should the LMI light stack go up a level? A longer reach puts more load on the machine.
- [ ] Can one move both angle and telescope the boom, for a zone that is up and to the side?
- [ ] Dismounted tablet: PIN or physical button to unlock? Both are designed (2a and 2b).
- [ ] Dismounted tablet: what happens if the wire disconnects while the tablet is off the truck? Does it lock again?
- [ ] Dismounted tablet: does it lock again after sitting idle, or when it goes back on the truck?
- [ ] Should the Outrigger switch component get an "off" version without the green glow?

## Backlog

- Add a Cancel button to the Toast component. Toasts should have one, like the wireframes' Allow and Configuring toasts.
- Design the side view panel.
- Keep the unused wire as action-disabled for now. It may be too faint outdoors, so revisit it with testing.
- Design the disconnect-from-wire flow, and what happens when the wire can't connect.


## Changes for code

Add one line per design change, with the Figma frame link. Say "sync" in Claude Code to apply them.

