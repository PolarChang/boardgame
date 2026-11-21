import { expect, it } from "vitest";
import { changedSpan } from "./EditorialChanges";
it("isolates changed costs while retaining unchanged surrounding text", () => {
  expect(changedSpan("支付 2 元後結束", "支付 12 元後結束")).toEqual({prefix:"支付 ",removed:"",added:"1",suffix:"2 元後結束"});
  expect(changedSpan("例外：無", "")).toEqual({prefix:"",removed:"例外：無",added:"",suffix:""});
});
