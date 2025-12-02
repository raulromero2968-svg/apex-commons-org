import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, TrendingUp, Target, Mail, Shield, AlertCircle, FileText, Menu, X } from "lucide-react";
import { useState } from "react";
import { AnimatedSection } from "@/components/AnimatedSection";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Starfield } from "@/components/Starfield";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative">
      <Starfield />
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2 sm:gap-3">
            <img src="/astro-ai-logo.png" alt="Apex Commons" className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
            <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              Apex Commons
            </div>
          </a>
          
          {/* Desktop Navigation - Only show on larger tablets and desktop */}
          <div className="desktop-nav items-center gap-6">
            <a href="/browse" className="text-sm font-medium hover:text-primary transition-colors">Browse Library</a>
            <a href="/features" className="text-sm font-medium hover:text-primary transition-colors">Technical Specs</a>
            <a href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">Roadmap</a>
            <a href="/about" className="text-sm font-medium hover:text-primary transition-colors">Mission</a>
            <a href="/blog" className="text-sm font-medium hover:text-primary transition-colors">Research</a>
            <a href="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</a>
            <a href="#waitlist">
              <Button size="sm">Join Waitlist</Button>
            </a>
          </div>

          {/* Mobile Menu Button - Show on mobile and tablets */}
          <button
            className="mobile-menu-btn p-2 hover:bg-primary/10 rounded-md transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            type="button"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-primary" />
            ) : (
              <Menu className="w-6 h-6 text-primary" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="mobile-nav border-t border-border/40 bg-background/95 backdrop-blur-sm w-full overflow-hidden">
            <div className="container py-4 flex flex-col gap-4 max-w-full">
              <a href="/browse" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Browse Library</a>
              <a href="/features" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Technical Specs</a>
              <a href="/pricing" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Roadmap</a>
              <a href="/about" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Mission</a>
              <a href="/blog" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Research</a>
              <a href="/contact" className="text-sm font-medium hover:text-primary transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a href="#waitlist" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full">Join Waitlist</Button>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Status Banner */}
      <div className="bg-primary/10 border-b border-primary/20 py-3">
        <div className="container">
          <div className="flex items-center justify-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-primary" />
            <span className="font-medium">Development Status:</span>
            <span className="text-muted-foreground">Technical manifesto and architecture design phase</span>
            <a href="#roadmap" className="text-primary hover:underline ml-2">View Roadmap →</a>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge className="w-fit mx-auto" variant="secondary">
              <FileText className="w-3 h-3 mr-1" />
              Technical Manifesto
            </Badge>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Building Secure Automation{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                For the Public Good
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A vision for enterprise-grade workflow automation that serves citizens, protects data, and strengthens our institutions. This is the technical plan to make it real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#waitlist">
                <Button size="lg" className="text-lg">Join the Waitlist</Button>
              </a>
              <a href="#mission">
                <Button size="lg" variant="outline" className="text-lg">Read the Vision</Button>
              </a>
            </div>
            <div className="pt-4 text-sm text-muted-foreground">
              <p>No product to sell yet. Just a mission and a plan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="secondary" className="w-fit mx-auto">
              <AlertCircle className="w-3 h-3 mr-1" />
              The Problem
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold">
              Our Systems Are Breaking Down
            </h2>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <Card className="bg-card/50 backdrop-blur border-destructive/50">
              <CardHeader>
                <CardTitle className="text-2xl">Why This Matters Now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p className="text-lg">
                  While institutions like the Library of Congress face defunding and PBS struggles to survive, we're losing the infrastructure that keeps our society informed and connected. At the same time, small businesses, freelancers, and agencies are drowning in administrative work—spending hours on tasks that could be automated.
                </p>
                <p className="text-lg">
                  The tools exist to fix this. But they're either too expensive, too complicated, or controlled by companies that don't have the public interest at heart.
                </p>
                <div className="grid md:grid-cols-2 gap-6 pt-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Current State:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>→ Public institutions underfunded and understaffed</li>
                      <li>→ Small businesses waste 40% of time on admin</li>
                      <li>→ Automation tools are expensive or vendor-locked</li>
                      <li>→ Data privacy is an afterthought</li>
                      <li>→ Critical infrastructure is fragile</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">What We Need:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>→ Accessible automation for everyone</li>
                      <li>→ Government-grade security by default</li>
                      <li>→ Transparent, trustworthy systems</li>
                      <li>→ Tools that serve the public good</li>
                      <li>→ Infrastructure built to last</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* The Vision Section */}
      <section id="vision" className="py-20 lg:py-32">
        <div className="container max-w-5xl">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="secondary" className="w-fit mx-auto">
              <Target className="w-3 h-3 mr-1" />
              The Vision
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold">
              What Apex Commons Will Be
            </h2>
          </div>

          <div className="space-y-12">
            <div className="prose prose-invert max-w-none">
              <p className="text-xl text-muted-foreground">
                Apex Commons is a vision for enterprise-grade workflow automation that's accessible, secure, and built for the public good. Not a product to sell—a system to build trust in.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <Shield className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Government-Grade Security</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Built with the same security standards used by federal agencies:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• End-to-end encryption (AES-256)</li>
                    <li>• Zero-trust architecture</li>
                    <li>• SOC 2 Type II compliance</li>
                    <li>• Regular security audits</li>
                    <li>• Data sovereignty guarantees</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <Zap className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Accessible to Everyone</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Powerful automation shouldn't require a CS degree or big budget:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• No-code workflow builder</li>
                    <li>• Free tier for individuals</li>
                    <li>• Transparent pricing</li>
                    <li>• Comprehensive documentation</li>
                    <li>• Community-driven development</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <TrendingUp className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Built to Scale</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Infrastructure designed for reliability and growth:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Microservices architecture</li>
                    <li>• Multi-region deployment</li>
                    <li>• 99.99% uptime SLA</li>
                    <li>• Automatic scaling</li>
                    <li>• Disaster recovery built-in</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <FileText className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Transparent & Open</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>No black boxes. No vendor lock-in. Just honest technology:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Open documentation</li>
                    <li>• Clear data policies</li>
                    <li>• Export your data anytime</li>
                    <li>• Public roadmap</li>
                    <li>• Community feedback loops</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Architecture Preview */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="secondary" className="w-fit mx-auto">
              <Zap className="w-3 h-3 mr-1" />
              Technical Architecture
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold">
              How It Will Work
            </h2>
            <p className="text-xl text-muted-foreground">
              This isn't vaporware. Here's the technical plan.
            </p>
          </div>

          <div className="space-y-8">
            <div className="relative">
              <img
                src="/architecture-hero-purple.png?v=notion2025"
                alt="Apex Commons System Architecture"
                className="rounded-lg border border-border/50 shadow-2xl holographic-image"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent rounded-lg" />
            </div>

            <Card className="bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl">Core Components</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <img src="/workflow-engine-starry.png?v=notion2025" alt="Workflow Orchestration Engine" className="rounded-lg border border-border/50 holographic-image" />
                    <div>
                      <h4 className="font-semibold text-sm text-primary">Workflow Engine</h4>
                      <p className="text-xs text-muted-foreground">DAG-based execution with automatic retry logic</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <img src="/automation-workflow-holographic.png?v=notion2025" alt="Data Pipeline" className="rounded-lg border border-border/50 holographic-image" />
                    <div>
                      <h4 className="font-semibold text-sm text-primary">Data Pipeline</h4>
                      <p className="text-xs text-muted-foreground">Real-time ETL with transformation rules</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <img src="/security-starry.png?v=notion2025" alt="Security Framework" className="rounded-lg border border-border/50 holographic-image" />
                    <div>
                      <h4 className="font-semibold text-sm text-primary">Security Framework</h4>
                      <p className="text-xs text-muted-foreground">Zero-trust with end-to-end encryption</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <img src="/ai-intelligence-holographic.png?v=notion2025" alt="AI Intelligence" className="rounded-lg border border-border/50 holographic-image" />
                    <div>
                      <h4 className="font-semibold text-sm text-primary">AI Intelligence</h4>
                      <p className="text-xs text-muted-foreground">Machine learning and predictive analytics</p>
                    </div>
                  </div>
                  <div className="space-y-3 md:col-span-2 lg:col-span-1">
                    <div className="h-full flex items-center justify-center bg-muted/20 rounded-lg border border-border/50 p-6 ">
                      <div className="text-center space-y-2">
                        <h4 className="font-semibold text-sm text-primary">+ More Components</h4>
                        <p className="text-xs text-muted-foreground">Integration Layer, AI Engine, Monitoring System</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <a href="/features" className="text-primary hover:underline text-sm font-medium">
                    Read the full technical specification →
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Development Roadmap */}
      <section id="roadmap" className="py-20 lg:py-32">
        <div className="container max-w-5xl">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="secondary" className="w-fit mx-auto">
              <TrendingUp className="w-3 h-3 mr-1" />
              Development Roadmap
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold">
              The Path Forward
            </h2>
            <p className="text-xl text-muted-foreground">
              Honest timeline. No false promises.
            </p>
          </div>

          <div className="space-y-6">
            <Card className="bg-primary/10 border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Phase 1: Foundation</CardTitle>
                  <Badge>Current Phase</Badge>
                </div>
                <CardDescription>Q1-Q2 2025</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>✓ Technical architecture design</p>
                <p>✓ Security framework specification</p>
                <p>→ Core workflow engine development</p>
                <p>→ Basic integration connectors</p>
                <p>→ Alpha testing with early adopters</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Phase 2: Core Platform</CardTitle>
                <CardDescription>Q3-Q4 2025</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>→ No-code workflow builder</p>
                <p>→ Expanded integration library</p>
                <p>→ User authentication and access control</p>
                <p>→ Beta launch with limited users</p>
                <p>→ Security audit and compliance certification</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Phase 3: Public Launch</CardTitle>
                <CardDescription>Q1 2026</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>→ Public beta with free tier</p>
                <p>→ AI-powered insights and optimization</p>
                <p>→ Team collaboration features</p>
                <p>→ Enterprise-grade SLA</p>
                <p>→ Community-driven feature development</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 p-6 border border-border/50 rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground text-center">
              <strong className="text-foreground">Transparency commitment:</strong> This roadmap will be updated monthly with progress reports. No hiding. No excuses.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-4xl">
          <div className="text-center space-y-8">
            <Badge variant="secondary" className="w-fit mx-auto">
              <Shield className="w-3 h-3 mr-1" />
              Our Mission
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold">
              Building for the Public Good
            </h2>
            <div className="prose prose-invert max-w-none text-lg text-muted-foreground space-y-6">
              <p>
                This isn't about getting rich. It's about building something that makes our country stronger, safer, and more efficient.
              </p>
              <p>
                When institutions like the Library of Congress are threatened and public infrastructure crumbles, we need alternatives. We need systems built by people who care about the public good, not just profit margins.
              </p>
              <p>
                Apex Commons is a commitment to building technology that serves citizens, protects data, and strengthens our institutions. It's a vision for what automation could be if we built it right.
              </p>
              <p className="text-foreground font-semibold">
                No product to sell yet. Just a mission and a plan to make it real.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section id="waitlist" className="py-20 lg:py-32">
        <div className="container max-w-3xl">
          <Card className="border-primary/50 shadow-lg shadow-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
            <CardHeader className="text-center space-y-4">
              <Badge variant="secondary" className="w-fit mx-auto">
                <Mail className="w-3 h-3 mr-1" />
                Join the Mission
              </Badge>
              <CardTitle className="text-3xl">Be Part of Building This</CardTitle>
              <CardDescription className="text-lg">
                Get updates on development progress. No spam. No sales pitches. Just honest updates from someone trying to build something that matters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WaitlistForm />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-muted/20">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img src="/astro-ai-logo.png" alt="Apex Commons" className="h-6 w-6" />
                <span className="font-bold text-lg">Apex Commons</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Building secure automation for the public good.
              </p>
              <p className="text-xs text-muted-foreground">
                by <a href="https://apexomnis.io" className="text-primary hover:underline">Apex Omnis Studio</a>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Documentation</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/features" className="hover:text-foreground transition-colors">Technical Specs</a></li>
                <li><a href="/pricing" className="hover:text-foreground transition-colors">Roadmap</a></li>
                <li><a href="/integrations" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/about" className="hover:text-foreground transition-colors">Mission</a></li>
                <li><a href="/blog" className="hover:text-foreground transition-colors">Research</a></li>
                <li><a href="/contact" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border/40 text-center text-sm text-muted-foreground">
            <p>© 2025 Apex Commons. All rights reserved.</p>
            <p className="mt-2">A product of Apex Omnis Studio</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

