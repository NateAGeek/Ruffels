import "@testing-library/jest-dom";
import type * as React from "react";

interface ShikiMockProps {
  readonly children: React.ReactNode;
}

jest.mock("react-shiki", () => ({
  __esModule: true,
  default: ({ children }: ShikiMockProps) => children,
}));

if (globalThis.structuredClone === undefined) {
  function cloneValue<ValueType>(value: ValueType): ValueType {
    return JSON.parse(JSON.stringify(value)) as ValueType;
  }

  Object.defineProperty(globalThis, "structuredClone", {
    value: cloneValue,
  });
}
