import type { StateContext } from '../types/state.types';

export abstract class State<TContext extends StateContext = StateContext> {
  abstract readonly name: string;

  onEnter(_context: TContext, _prevState: string | null): void {}

  onExit(_context: TContext, _nextState: string): void {}

  onUpdate(_context: TContext, _deltaTime: number): void {}

  canEnter(_context: TContext, _fromState: string | null): boolean {
    return true;
  }

  canExit(_context: TContext, _toState: string): boolean {
    return true;
  }
}
