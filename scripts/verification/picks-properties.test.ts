import { expect, it } from "vitest";
import fc from "fast-check";
import { normalizeCloudPayloadToSections } from "../../src/lib/picks";

it("keeps recommendation buckets ordered and a game unique within each player section",() => {
  const seed = Number(process.env.VERIFICATION_SEED || 20261119);
  console.info(`Recommendation property seed=${seed}; 1000 generated cases`);
  fc.assert(fc.property(fc.array(fc.integer({min:2,max:6}),{maxLength:30}),counts => {
    const sections = normalizeCloudPayloadToSections([{bgg_id:"one",name:"測試",best_for:counts}]);
    expect(sections.map(section => section.count)).toEqual([2,3,4,5,6]);
    for (const section of sections) expect(section.games.length).toBe(counts.includes(section.count) ? 1 : 0);
  }),{seed,numRuns:1000,verbose:true});
});
