// Subtle page transition: each storefront page fades in on navigation.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
