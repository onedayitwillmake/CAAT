/**
 * @author  Hyperandroid  ||  http://hyperandroid.com/
 *
 * Scene is the top level ActorContainer of the Director at any given time.
 * The only time when 2 scenes could be active will be during scene change.
 * An scene controls the way it enters/exits the scene graph.
 *
 *
 *
 */

/**
 * This class defines a timer action.
 * These actions are constrained to Scene time, so every Scene has the abbility to create its own TimerTask objects.
 * A TimerTask is defined at least by:
 *  + startTime: since when the timer will be active
 *  + duration:  from startTime to startTime+duration, the timerTask will be notifying (if set) the callback callback_tick.
 *
 * Upon TimerTask expiration, the TimerTask will notify (if set) the callback function callback_timeout.
 * Upon a call to the method cancel, the timer will be set expired, and (if set) the callback to callback_cancel will be
 * invoked.
 *
 * Timer notifications will be performed *BEFORE* scene loop.
 */
(function() {
    CAAT.TimerTask= function() {
        return this;
    };

    CAAT.TimerTask.prototype= {
        startTime:          0,
        duration:           0,
        callback_timeout:   null,
        callback_tick:      null,
        callback_cancel:    null,

        scene:              null,
        taskId:             0,
        remove:             false,

        /**
         * Create a TimerTask.
         * The taskId will be set by the scene.
         * @param startTime an integer indicating TimerTask enable time.
         * @param duration an integer indicating TimerTask duration.
         * @param callback_timeout on timeout callback function.
         * @param callback_tick on tick callback function.
         * @param callback_cancel on cancel callback function.
         */
        create: function( startTime, duration, callback_timeout, callback_tick, callback_cancel ) {
            this.startTime=         startTime;
            this.duration=          duration;
            this.callback_timeout=  callback_timeout;
            this.callback_tick=     callback_tick;
            return this;
        },
        /**
         * Performs TimerTask operation.
         * The task will check whether it is in frame time, and will either notify callback_timeout or callback_tick.
         * @param time an integer indicating scene time.
         */
        checkTask : function(time) {
            var ttime= time;
            ttime-= this.startTime;
            if ( ttime>=this.duration ) {
                this.remove= true;
                if( this.callback_timeout ) {
                    this.callback_timeout( time, ttime, this );
                }
            } else {
                if ( this.callback_tick ) {
                    this.callback_tick( time, ttime, this );
                }
            }
            return this;
        },
        /**
         * Reschedules this TimerTask by changing its startTime to current scene's time.
         * @param time an integer indicating scene time.
         */
        reset : function( time ) {
            this.remove= false;
            this.startTime=  time;
            return this;
        },
        /**
         * Cancels this timer by removing it on scene's next frame.
         * The function callback_cancel will be called.
         */
        cancel : function() {
            this.remove= true;
            if ( null!=this.callback_cancel ) {
                this.callback_cancel( this.scene.time, this.scene.time-this.startTime, this );
            }
            return this;
        }
    };
})();


(function() {
	CAAT.Scene= function() {
		CAAT.Scene.superclass.constructor.call(this);
        this.timerList= [];
		return this;
	};
	
	extend( CAAT.Scene, CAAT.ActorContainer, {
		
		easeContainerBehaviour:			null,   // Behavior container used uniquely for Scene switching.
		easeContainerBehaviourListener: null,   // who to notify about container behaviour events. Array.
		easeIn:							false,  // When Scene switching, this boolean identifies whether the
                                                // Scene is being brought in, or taken away.

        EASE_ROTATION:					1,      // Constant values to identify the type of Scene transition
		EASE_SCALE:						2,      // to perform on Scene switching by the Director.
		EASE_TRANSLATE:					3,

        timerList:                      null,   // collection of CAAT.TimerTask objects.
        timerSequence:                  0,      // incremental CAAT.TimerTask id.

        /**
         * Check and apply timers in frame time.
         * @param time the current Scene time.
         */
        checkTimers : function(time) {
            var i=this.timerList.length-1;
            while( i>=0 ) {
                if ( !this.timerList[i].remove ) {
                    this.timerList[i].checkTask(time);
                }
                i--;
            }
        },
        /**
         * Creates a timer task. Timertask live and are related to scene's time.
         * @param startTime an integer indicating the scene time this task must start executing at.
         * @param duration an integer indicating the timerTask duration.
         * @param callback_timeout timer on timeout callback function.
         * @param callback_tick timer on tick callback function.
         * @param callback_cancel timer on cancel callback function.
         *
         * @return a CAAT.TimerTask class instance.
         */
        createTimer : function( startTime, duration, callback_timeout, callback_tick, callback_cancel ) {

            var tt= new CAAT.TimerTask().create(
                        startTime,
                        duration,
                        callback_timeout, 
                        callback_tick,
                        callback_cancel );

            tt.taskId= this.timerSequence++;
            tt.sceneTime = this.time;
            tt.scene= this;

            this.timerList.push( tt );

            return tt;
        },
        /**
         * Removes expired timers. This method must not be called directly.
         */
        removeExpiredTimers : function() {
            var i;
            for( i=0; i<this.timerList.length; i++ ) {
                if ( this.timerList[i].remove ) {
                    this.timerList.splice(i,1);
                }
            }
        },
        /**
         * Scene animation method.
         * It extends Container's base behavior by adding timer control.
         * @param director a CAAT.Director instance.
         * @param time an integer indicating the Scene time the animation is being performed at.
         */
        animate : function(director, time) {
            this.checkTimers(time);
            CAAT.Scene.superclass.animate.call(this,director,time);
            this.removeExpiredTimers();
        },
        /**
         * Private.
         * Helper method to manage alpha transparency fading on Scene switch by the Director.
         * @param time integer indicating the time in milliseconds the fading will take.
         * @param isIn boolean indicating whether this Scene in the switch process is being brought in.
         */
		createAlphaBehaviour: function(time, isIn) {
			var ab= new CAAT.AlphaBehavior();
			ab.setFrameTime( 0, time );
			ab.startAlpha= isIn ? 0 : 1;
			ab.endAlpha= isIn ? 1 : 0;
			this.easeContainerBehaviour.addBehavior(ab);
		},
        /**
         * Called from CAAT.Director to bring in an Scene.
         * A helper method for easeTranslation.
         * @param time integer indicating time in milliseconds for the Scene to be brought in.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         */
		easeTranslationIn : function( time, alpha, anchor, interpolator ) {
            this.easeTranslation( time, alpha, anchor, true, interpolator );
        },
        /**
         * Called from CAAT.Director to bring in an Scene.
         * A helper method for easeTranslation.
         * @param time integer indicating time in milliseconds for the Scene to be taken away.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         */
        easeTranslationOut : function( time, alpha, anchor, interpolator ) {
            this.easeTranslation( time, alpha, anchor, false, interpolator );
        },
        /**
         * This method will setup Scene behaviours to switch an Scene via a translation.
         * The anchor value can only be
         *  <li>CAAT.Actor.prototype.ANCHOR_LEFT
         *  <li>CAAT.Actor.prototype.ANCHOR_RIGHT
         *  <li>CAAT.Actor.prototype.ANCHOR_TOP
         *  <li>CAAT.Actor.prototype.ANCHOR_BOTTOM
         * if any other value is specified, any of the previous ones will be applied.
         *
         * @param time integer indicating time in milliseconds for the Scene.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param isIn boolean indicating whether the scene will be brought in.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         */
		easeTranslation : function( time, alpha, anchor, isIn, interpolator ) {

            this.easeContainerBehaviour= new CAAT.ContainerBehavior();
            this.easeIn= isIn;

            var pb= new CAAT.PathBehavior();
            if ( interpolator ) {
                pb.setInterpolator( interpolator );
            }

            pb.setFrameTime( 0, time );

            // BUGBUG anchors: 1..4
            if ( anchor<1 ) {
                anchor=1;
            } else if ( anchor>4 ) {
                anchor= 4;
            }


			switch(anchor) {
			case CAAT.Actor.prototype.ANCHOR_TOP:
                if ( isIn ) {
                    pb.setPath( new CAAT.Path().setLinear( 0, -this.height, 0, 0) );
                } else {
                    pb.setPath( new CAAT.Path().setLinear( 0, 0, 0, -this.height) );
                }
                break;
            case CAAT.Actor.prototype.ANCHOR_BOTTOM:
                if ( isIn ) {
                    pb.setPath( new CAAT.Path().setLinear( 0, this.height, 0, 0) );
                } else {
                    pb.setPath( new CAAT.Path().setLinear( 0, 0, 0, this.height) );
                }
                break;
            case CAAT.Actor.prototype.ANCHOR_LEFT:
                if ( isIn ) {
                    pb.setPath( new CAAT.Path().setLinear( -this.width, 0, 0, 0) );
                } else {
                    pb.setPath( new CAAT.Path().setLinear( 0, 0, -this.width, 0) );
                }
                break;
            case CAAT.Actor.prototype.ANCHOR_RIGHT:
                if ( isIn ) {
                    pb.setPath( new CAAT.Path().setLinear( this.width, 0, 0, 0) );
                } else {
                    pb.setPath( new CAAT.Path().setLinear( 0, 0, this.width, 0) );
                }
                break;
            }

			if (alpha) {
				this.createAlphaBehaviour(time,isIn);
			}

			this.easeContainerBehaviour.addBehavior(pb);

			this.easeContainerBehaviour.setFrameTime( this.time, time );
			this.easeContainerBehaviour.addListener(this);

			this.emptyBehaviorList();
			CAAT.Scene.superclass.addBehavior.call( this, this.easeContainerBehaviour );
		},
        /**
         * Called from CAAT.Director to bring in a Scene.
         * A helper method for easeScale.
         * @param time integer indicating time in milliseconds for the Scene to be brought in.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         * @param starttime integer indicating in milliseconds from which scene time the behavior will be applied.
         */
		easeScaleIn : function(starttime,time,alpha,anchor,interpolator) {
			this.easeScale(starttime,time,alpha,anchor,true,interpolator);
			this.easeIn= true;
		},
        /**
         * Called from CAAT.Director to take away a Scene.
         * A helper method for easeScale.
         * @param time integer indicating time in milliseconds for the Scene to be taken away.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         * @param starttime integer indicating in milliseconds from which scene time the behavior will be applied.
         */
		easeScaleOut : function(starttime,time,alpha,anchor,interpolator) {
			this.easeScale(starttime,time,alpha,anchor,false,interpolator);
			this.easeIn= false;
		},
        /**
         * Called from CAAT.Director to bring in ot take away an Scene.
         * @param time integer indicating time in milliseconds for the Scene to be taken away.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         * @param starttime integer indicating in milliseconds from which scene time the behavior will be applied.
         * @param isIn boolean indicating whether the Scene is being brought in.
         */
		easeScale : function(starttime,time,alpha,anchor,isIn,interpolator) {
			this.easeContainerBehaviour= new CAAT.ContainerBehavior();

			var x=0;
			var y=0;
			var x2=0;
			var y2=0;
			
			switch(anchor) {
			case CAAT.Actor.prototype.ANCHOR_TOP_LEFT:
			case CAAT.Actor.prototype.ANCHOR_TOP_RIGHT:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM_LEFT:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM_RIGHT:
			case CAAT.Actor.prototype.ANCHOR_CENTER:
				x2=1;
				y2=1;
				break;
			case CAAT.Actor.prototype.ANCHOR_TOP:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM:
				x=1;
				x2=1;
				y=0;
				y2=1;
				break;
			case CAAT.Actor.prototype.ANCHOR_LEFT:
			case CAAT.Actor.prototype.ANCHOR_RIGHT:
				y=1;
				y2=1;
				x=0;
				x2=1;
				break;
			default:
				alert('scale anchor ?? '+anchor);
			}

			if ( !isIn ) {
				var tmp;
				tmp= x;
				x= x2;
				x2= tmp;
				
				tmp= y;
				y= y2;
				y2= tmp;
			}
			
			if (alpha) {
				this.createAlphaBehaviour(time,isIn);
			}
			
			var sb= new CAAT.ScaleBehavior();
			sb.setFrameTime( starttime, time );
			sb.startScaleX= x;
			sb.startScaleY= y;
			sb.endScaleX= x2;
			sb.endScaleY= y2;
			sb.anchor= anchor;

            if ( interpolator ) {
                sb.setInterpolator(interpolator);
            }

			this.easeContainerBehaviour.addBehavior(sb);
			
			this.easeContainerBehaviour.setFrameTime( this.time, time );
			this.easeContainerBehaviour.addListener(this);
			
			this.emptyBehaviorList();
			CAAT.Scene.superclass.addBehavior.call( this, this.easeContainerBehaviour );
		},
		/**
         * Private.
         * Overriden method to disallow default behavior.
		 * Do not use directly.
		 */
		addBehavior : function(behaviour) {
			
		},
        /**
         * Called from CAAT.Director to use Rotations for bringing in.
         * This method is a Helper for the method easeRotation.
         * @param time integer indicating time in milliseconds for the Scene to be brought in.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         */
		easeRotationIn : function(time,alpha,anchor,interpolator) {
			this.easeRotation(time,alpha,anchor,true, interpolator);
			this.easeIn= true;
		},
        /**
         * Called from CAAT.Director to use Rotations for taking Scenes away.
         * This method is a Helper for the method easeRotation.
         * @param time integer indicating time in milliseconds for the Scene to be taken away.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         */
		easeRotationOut : function(time,alpha,anchor,interpolator) {
			this.easeRotation(time,alpha,anchor,false,interpolator);
			this.easeIn= false;
		},
        /**
         * Called from CAAT.Director to use Rotations for taking away or bringing Scenes in.
         * @param time integer indicating time in milliseconds for the Scene to be taken away or brought in.
         * @param alpha boolean indicating whether fading will be applied to the Scene.
         * @param anchor integer indicating the Scene switch anchor.
         * @param interpolator CAAT.Interpolator to apply to the Scene transition.
         * @param isIn boolean indicating whehter the Scene is brought in.
         */
		easeRotation : function(time,alpha,anchor,isIn,interpolator) {
			this.easeContainerBehaviour= new CAAT.ContainerBehavior();
			
			var start=0;
			var end=0;
			switch(anchor) {
			case CAAT.Actor.prototype.ANCHOR_CENTER:
				anchor= CAAT.Actor.prototype.ANCHOR_TOP;
			case CAAT.Actor.prototype.ANCHOR_TOP:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM:
			case CAAT.Actor.prototype.ANCHOR_LEFT:
			case CAAT.Actor.prototype.ANCHOR_RIGHT:
				start= Math.PI * (Math.random()<.5 ? 1 : -1);
				break;
			case CAAT.Actor.prototype.ANCHOR_TOP_LEFT:
			case CAAT.Actor.prototype.ANCHOR_TOP_RIGHT:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM_LEFT:
			case CAAT.Actor.prototype.ANCHOR_BOTTOM_RIGHT:
				start= Math.PI/2 * (Math.random()<.5 ? 1 : -1);
				break;
			default:
				alert('rot anchor ?? '+anchor);
			}

			if ( false==isIn ) {
				var tmp= start;
				start=end;
				end= tmp;
			}

			if ( alpha ) {
				this.createAlphaBehaviour(time,isIn);
			}
			
			var rb= new CAAT.RotateBehavior();
			rb.setFrameTime( 0, time );
			rb.startAngle= start;
			rb.endAngle= end;
			rb.anchor= anchor;

            if ( interpolator ) {
                rb.setInterpolator(interpolator);
            }
			this.easeContainerBehaviour.addBehavior(rb);
			
			
			this.easeContainerBehaviour.setFrameTime( this.time, time );
			this.easeContainerBehaviour.addListener(this);
			
			this.emptyBehaviorList();
			CAAT.Scene.superclass.addBehavior.call( this, this.easeContainerBehaviour );
		},
        /**
         * Registers a listener for listen for transitions events.
         * Al least, the Director registers himself as Scene easing transition listener.
         * When the transition is done, it restores the Scene's capability of receiving events.
         * @param listener an object which contains a method of the form <code>
         * behaviorExpired( caat_behaviour, time, actor);
         */
		setEaseListener : function( listener ) {
			this.easeContainerBehaviourListener=listener;
		},
        /**
         * Private.
         * listener for the Scene's easeContainerBehaviour.
         * @param actor
         */
		behaviorExpired : function(actor) {
			this.easeContainerBehaviourListener.easeEnd(this, this.easeIn);
		},
        /**
         * This method should be overriden in case the developer wants to do some special actions when
         * the scene has just been brought in.
         */
        activated : function() {
        },
        /**
         * Scenes, do not expire the same way Actors do.
         * It simply will be set expired=true, but the frameTime won't be modified.
         */
        setExpired : function(bExpired) {
            this.expired= bExpired;
        },
        paint : function(director, time) {

			var ctx= director.crc;

            ctx.fillStyle= this.fillStyle!=null ? this.fillStyle : 'white';
            ctx.fillRect(0,0,this.width,this.height );
        }
	});
})();