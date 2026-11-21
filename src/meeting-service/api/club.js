import {get,put} from '@vercel/blob';
import {waitUntil} from '@vercel/functions';
import {clubHandler} from '../lib/meet.js';
import {notionMeetingRecords} from '../lib/notion-records.js';

const token=process.env.NOTION_TOKEN;
const gatheringsDb=process.env.NOTION_GATHERINGS_DB_ID;
const registrationsDb=process.env.NOTION_REGISTRATIONS_DB_ID;
const records=token&&gatheringsDb&&registrationsDb
  ?notionMeetingRecords({token,gatheringsDb,registrationsDb})
  :undefined;
export default clubHandler('club/v1.json',{get,put},{records,defer:waitUntil});
