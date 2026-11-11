import { createFileRoute, redirect } from "@tanstack/react-router";

// Entry point: every visitor starts on the /descubra pre-landing page, which
// links on to the signup page (/cadastro). The query string (utm_*, click_id)
// is kept so tracking survives the redirect.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/descubra", search: true, statusCode: 302 });
  },
});
