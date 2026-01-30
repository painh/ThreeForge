import { EventEmitter } from '../utils/EventEmitter';
import type {
  StateContext,
  StateConfig,
  StateMachineConfig,
  TransitionCondition,
  StateEvents,
  IStateMachine,
} from '../types/state.types';

interface InternalState<TContext extends StateContext> {
  config: StateConfig<TContext>;
  transitions: TransitionCondition<TContext>[];
}

export class StateMachine<TContext extends StateContext = StateContext>
  implements IStateMachine<TContext>
{
  private states: Map<string, InternalState<TContext>> = new Map();
  private _currentState: string | null = null;
  private _previousState: string | null = null;
  private _context: TContext;
  private globalTransitions: TransitionCondition<TContext>[] = [];

  readonly events: EventEmitter<StateEvents> = new EventEmitter();

  constructor(config?: StateMachineConfig<TContext>) {
    this._context = (config?.context ?? {}) as TContext;

    if (config?.states) {
      config.states.forEach((stateConfig) => {
        this.addState(stateConfig);
      });
    }

    if (config?.globalTransitions) {
      config.globalTransitions.forEach((transition) => {
        this.addGlobalTransition(transition);
      });
    }

    if (config?.initialState) {
      this.transition(config.initialState, true);
    }
  }

  get currentState(): string | null {
    return this._currentState;
  }

  get previousState(): string | null {
    return this._previousState;
  }

  get context(): TContext {
    return this._context;
  }

  addState(config: StateConfig<TContext>): void {
    if (this.states.has(config.name)) {
      console.warn(`State "${config.name}" already exists. Overwriting.`);
    }

    this.states.set(config.name, {
      config,
      transitions: config.transitions ?? [],
    });
  }

  removeState(name: string): boolean {
    if (this._currentState === name) {
      console.warn(`Cannot remove current state "${name}"`);
      return false;
    }
    return this.states.delete(name);
  }

  hasState(name: string): boolean {
    return this.states.has(name);
  }

  transition(to: string, force: boolean = false): boolean {
    const targetState = this.states.get(to);
    if (!targetState) {
      console.warn(`State "${to}" does not exist`);
      return false;
    }

    const currentStateData = this._currentState ? this.states.get(this._currentState) : null;

    if (!force && currentStateData) {
      if (currentStateData.config.onExit) {
        // Check if transition is allowed
      }
    }

    if (currentStateData?.config.onExit) {
      currentStateData.config.onExit(this._context, to);
      this.events.emit('stateExit', {
        state: this._currentState!,
        nextState: to,
      });
    }

    this._previousState = this._currentState;
    this._currentState = to;

    if (targetState.config.onEnter) {
      targetState.config.onEnter(this._context, this._previousState);
    }

    this.events.emit('stateEnter', {
      state: to,
      prevState: this._previousState,
    });

    return true;
  }

  set<K extends keyof TContext>(key: K, value: TContext[K]): void {
    this._context[key] = value;
  }

  get<K extends keyof TContext>(key: K): TContext[K] {
    return this._context[key];
  }

  update(deltaTime: number): void {
    if (!this._currentState) return;

    const currentStateData = this.states.get(this._currentState);
    if (!currentStateData) return;

    // Check global transitions first
    const globalTransition = this.findTransition(this.globalTransitions);
    if (globalTransition && globalTransition.to !== this._currentState) {
      this.transition(globalTransition.to);
      return;
    }

    // Check state-specific transitions
    const stateTransition = this.findTransition(currentStateData.transitions);
    if (stateTransition) {
      this.transition(stateTransition.to);
      return;
    }

    // Run onUpdate
    if (currentStateData.config.onUpdate) {
      currentStateData.config.onUpdate(this._context, deltaTime);
    }

    this.events.emit('stateUpdate', {
      state: this._currentState,
      deltaTime,
    });
  }

  addGlobalTransition(transition: TransitionCondition<TContext>): void {
    this.globalTransitions.push(transition);
    this.globalTransitions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  removeGlobalTransition(to: string): boolean {
    const index = this.globalTransitions.findIndex((t) => t.to === to);
    if (index !== -1) {
      this.globalTransitions.splice(index, 1);
      return true;
    }
    return false;
  }

  private findTransition(
    transitions: TransitionCondition<TContext>[]
  ): TransitionCondition<TContext> | null {
    for (const transition of transitions) {
      if (transition.condition(this._context)) {
        return transition;
      }
    }
    return null;
  }

  reset(): void {
    this._currentState = null;
    this._previousState = null;
  }

  getStateNames(): string[] {
    return Array.from(this.states.keys());
  }
}
