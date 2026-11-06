import { parseOcrMatchStats } from '../src/utils/matchStats';

export default {
  fetch() {
    const parsed = parseOcrMatchStats('{"playerName":"Nick","kills":19,"deaths":9,"assists":5,"minions":330,"gold":23941}');
    return Response.json({ status: 'ok', parsed });
  },
};
