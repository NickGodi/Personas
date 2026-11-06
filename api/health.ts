export default {
  fetch() {
    return Response.json({ status: 'ok', app: 'Personas', time: new Date().toISOString() });
  },
};
