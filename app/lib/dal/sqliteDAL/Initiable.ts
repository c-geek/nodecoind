
export abstract class Initiable {
  abstract init(): Promise<void>
  abstract cleanCache(): void
}
