export interface StateContext {
  [key: string]: unknown;
}

export interface TransitionCondition<TContext extends StateContext = StateContext> {
  to: string;
  condition: (context: TContext) => boolean;
  priority?: number;
}

export interface StateConfig<TContext extends StateContext = StateContext> {
  name: string;
  onEnter?: (context: TContext, prevState: string | null) => void;
  onExit?: (context: TContext, nextState: string) => void;
  onUpdate?: (context: TContext, deltaTime: number) => void;
  transitions?: TransitionCondition<TContext>[];
}

export interface StateMachineConfig<TContext extends StateContext = StateContext> {
  initialState: string;
  context?: TContext;
  states: StateConfig<TContext>[];
  globalTransitions?: TransitionCondition<TContext>[];
}

export interface StateEvents {
  stateEnter: { state: string; prevState: string | null };
  stateExit: { state: string; nextState: string };
  stateUpdate: { state: string; deltaTime: number };
  transitionBlocked: { from: string; to: string; reason: string };
}

export interface IStateMachine<TContext extends StateContext = StateContext> {
  readonly currentState: string | null;
  readonly context: TContext;
  readonly previousState: string | null;

  addState(config: StateConfig<TContext>): void;
  removeState(name: string): boolean;
  hasState(name: string): boolean;

  transition(to: string, force?: boolean): boolean;
  set<K extends keyof TContext>(key: K, value: TContext[K]): void;
  get<K extends keyof TContext>(key: K): TContext[K];

  update(deltaTime: number): void;

  addGlobalTransition(transition: TransitionCondition<TContext>): void;
  removeGlobalTransition(to: string): boolean;
}
