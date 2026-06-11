export default {
  fetch(): Response {
    return Response.json({
      status: "ok",
      transport: "vercel",
      mcp: "/api/mcp",
    });
  },
};
