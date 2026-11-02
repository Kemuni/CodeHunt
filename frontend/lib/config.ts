const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export const routes = {
  employers: `${API_ORIGIN}/api/contact-request/employer`,
  candidates: `${API_ORIGIN}/api/contact-request/candidate`
}