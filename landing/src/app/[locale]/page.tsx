import { setRequestLocale } from 'next-intl/server';
import { ComingSoonProvider } from '@/components/ComingSoon';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Marquee from '@/components/Marquee';
import Manifesto from '@/components/Manifesto';
import Story from '@/components/Story';
import HowItWorks from '@/components/HowItWorks';
import RingDemo from '@/components/RingDemo';
import Features from '@/components/Features';
import Widgets from '@/components/Widgets';
import Completion from '@/components/Completion';
import ShareCards from '@/components/ShareCards';
import Quote from '@/components/Quote';
import FinalCta from '@/components/FinalCta';
import Footer from '@/components/Footer';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ComingSoonProvider>
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main id="top">
        <Hero />
        <Marquee />
        <Manifesto />
        <Story />
        <HowItWorks />
        <RingDemo />
        <Features />
        <Widgets />
        <Completion />
        <ShareCards />
        <Quote />
        <FinalCta />
      </main>
      <Footer />
    </ComingSoonProvider>
  );
}
