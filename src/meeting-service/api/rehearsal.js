// The standalone rehearsal no longer provides an alternate organizer-key entry.
export default function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 return res.status(410).json({error:'線上試用入口已停用，請從桌遊清單進入策略桌遊聚會'});
}
