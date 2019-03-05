interface String {
    rightOf(search: string): string;
    rightRightOf(souschaine: string): string;
    stripAccents(): string;
    contains(it: string): boolean;
    leftOf(souschaine: string): string;
    removeEnd(s: string, caseInsensistive?: boolean): string;
}
