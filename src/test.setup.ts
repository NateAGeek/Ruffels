import "@testing-library/jest-dom";

if (globalThis.structuredClone === undefined) {
  function cloneValue<ValueType>(value: ValueType): ValueType {
    return JSON.parse(JSON.stringify(value)) as ValueType;
  }

  Object.defineProperty(globalThis, "structuredClone", {
    value: cloneValue,
  });
}
