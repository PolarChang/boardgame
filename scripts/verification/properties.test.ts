import { expect, it } from "vitest";
import fc from "fast-check";
import { pages, parseEditorial, serializeEditorial } from "../../src/lib/editorial";
import { pdfPageLink } from "../../src/lib/editorial-reader";
import { normalizeCloudPayloadToSections } from "../../src/lib/picks";

const seed = Number(process.env.VERIFICATION_SEED || 20261119);
const options = {seed,numRuns:1000,verbose:true};
console.info(`Property verification seed=${seed}; 1000 generated inputs per property; failures include shrink path/counterexample`);
const safeText = fc.array(fc.constantFrom("港","灣","A","9","資","源","é","🚢"),{minLength:1,maxLength:50}).map(chars => chars.join(""));
it("round-trips valid manuscript fields without changing their meaning",() => {
  fc.assert(fc.property(safeText,safeText,(title,content) => {
    const document = {blocks:[{kind:"規則",id:"R1",fields:{標題:title,內容:content}}]};
    expect(parseEditorial(serializeEditorial(document)).document).toEqual(document);
  }),options);
});
it("deduplicates and orders page lists and rejects out-of-bounds pages",() => {
  fc.assert(fc.property(fc.array(fc.integer({min:1,max:1000}),{minLength:1,maxLength:80}),values => {
    const expected = [...new Set(values)].sort((a,b) => a-b);
    expect(pages(values.join(","))).toEqual(expected);
    expect(pages(expected.join("、"))).toEqual(expected);
    expect(pages(values.join(",") + ",1001")).toEqual([]);
  }),options);
});
it("preserves PDF identity and query while replacing the physical page anchor",() => {
  fc.assert(fc.property(fc.integer({min:1,max:1000}),safeText,(page,token) => {
    const url = new URL("https://example.invalid/rules.pdf"); url.searchParams.set("version",token);
    const result = pdfPageLink(url.href + "#old",String(page));
    expect(result?.page).toBe(page);
    expect(new URL(result!.href).searchParams.get("version")).toBe(token);
    expect(new URL(result!.href).hash).toBe(`#page=${page}`);
    expect(pdfPageLink("javascript:" + token,String(page))).toBeNull();
  }),options);
});
it("normalizes recommendation buckets without duplicating a game within a player section",() => {
  fc.assert(fc.property(fc.array(fc.integer({min:2,max:6}),{maxLength:30}),counts => {
    const sections = normalizeCloudPayloadToSections([{bgg_id:"one",name:"測試",best_for:counts}]);
    expect(sections.map(section => section.count)).toEqual([2,3,4,5,6]);
    for (const section of sections) expect(section.games.length).toBe(counts.includes(section.count) ? 1 : 0);
  }),options);
});
