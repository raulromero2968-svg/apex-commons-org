import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Starfield } from "@/components/Starfield";
import { z } from "zod";

// Validation constants (matching server)
const CATEGORIES = [
  "Mathematics",
  "Science",
  "History",
  "Computer Science",
  "Language Arts",
  "Social Studies",
  "Arts",
  "Physical Education",
  "Other",
] as const;

const GRADE_LEVELS = [
  "Elementary",
  "Middle School",
  "High School",
  "University",
  "Professional",
] as const;

const RESOURCE_TYPES = [
  "Lesson Plan",
  "Worksheet",
  "Video",
  "Interactive",
  "Assessment",
  "Presentation",
  "Article",
  "Other",
] as const;

// Client-side validation schema
const contributionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description too long"),
  category: z.enum(CATEGORIES, { message: "Please select a category" }),
  gradeLevel: z.enum(GRADE_LEVELS, { message: "Please select a grade level" }),
  resourceType: z.enum(RESOURCE_TYPES, { message: "Please select a resource type" }),
  tags: z.string().optional(),
});

type FormData = {
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number] | "";
  gradeLevel: (typeof GRADE_LEVELS)[number] | "";
  resourceType: (typeof RESOURCE_TYPES)[number] | "";
  tags: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/plain",
  "application/zip",
];

export default function Contribute() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    gradeLevel: "",
    resourceType: "",
    tags: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  // tRPC mutation
  const createResource = trpc.resources.create.useMutation({
    onSuccess: (data) => {
      setSubmitSuccess(true);
      setIsSubmitting(false);
      // Redirect to browse after 2 seconds
      setTimeout(() => {
        navigate("/browse");
      }, 2000);
    },
    onError: (error) => {
      setSubmitError(error.message || "Failed to create resource");
      setIsSubmitting(false);
    },
  });

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError("File size must be less than 50MB");
      setFile(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setFileError("File type not supported. Please upload a PDF, document, video, or image.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const fakeEvent = {
          target: { files: [droppedFile] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(fakeEvent);
      }
    },
    [handleFileChange]
  );

  // Validate form
  const validateForm = (): boolean => {
    try {
      contributionSchema.parse({
        ...formData,
        category: formData.category || undefined,
        gradeLevel: formData.gradeLevel || undefined,
        resourceType: formData.resourceType || undefined,
      });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: FormErrors = {};
        err.issues.forEach((issue) => {
          const field = issue.path[0] as keyof FormData;
          newErrors[field] = issue.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let fileData: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      let fileSize: string | undefined;

      // Convert file to base64 if present
      if (file) {
        const buffer = await file.arrayBuffer();
        fileData = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        fileName = file.name;
        mimeType = file.type;
        fileSize = formatFileSize(file.size);
      }

      await createResource.mutateAsync({
        title: formData.title,
        description: formData.description,
        category: formData.category as (typeof CATEGORIES)[number],
        gradeLevel: formData.gradeLevel as (typeof GRADE_LEVELS)[number],
        resourceType: formData.resourceType as (typeof RESOURCE_TYPES)[number],
        tags: formData.tags || undefined,
        fileData,
        fileName,
        mimeType,
        fileSize,
      });
    } catch {
      // Error handled by mutation onError
    }
  };

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col relative bg-slate-950">
        <Starfield />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6 text-6xl opacity-50">
              <AlertCircle className="mx-auto h-16 w-16 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Authentication Required</h1>
            <p className="text-slate-400 mb-8">
              You need to be logged in to contribute resources to the library.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Go Home
                </Button>
              </Link>
              <a href="/#waitlist">
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-600">
                  Join Waitlist
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative bg-slate-950">
      <Starfield />

      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-md sticky top-0 z-50 bg-slate-950/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <img
              src="/astro-ai-logo.png"
              alt="Apex Commons"
              className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0"
            />
            <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent whitespace-nowrap">
              Apex Commons
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="desktop-nav items-center gap-6">
            <Link
              href="/browse"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/contribute"
              className="text-sm font-medium text-cyan-400 transition-colors"
            >
              Contribute
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-slate-300 hover:text-cyan-400 transition-colors"
            >
              Mission
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn p-2 hover:bg-white/10 rounded-md transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            type="button"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-cyan-400" />
            ) : (
              <Menu className="w-6 h-6 text-cyan-400" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="mobile-nav border-t border-white/10 bg-slate-950/95 backdrop-blur-md w-full">
            <div className="container py-4 flex flex-col gap-4">
              <Link
                href="/browse"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse
              </Link>
              <Link
                href="/contribute"
                className="text-sm font-medium text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contribute
              </Link>
              <Link
                href="/about"
                className="text-sm font-medium text-slate-300 hover:text-cyan-400 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Mission
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              Contribute a Resource
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto">
              Share your educational materials with the community. Your contributions help teachers
              and students everywhere.
            </p>
          </div>

          {/* Success State */}
          {submitSuccess ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-green-500/20 p-4">
                  <Check className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Resource Submitted!</h2>
              <p className="text-slate-400 mb-4">
                Thank you for your contribution. Redirecting to the library...
              </p>
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Error Banner */}
              {submitError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Submission Failed</p>
                    <p className="text-red-400/80 text-sm">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Section 1: Basic Information */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs text-cyan-400">
                    1
                  </span>
                  Basic Information
                </h2>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g., Introduction to Photosynthesis"
                      className={`w-full rounded-lg border ${
                        errors.title ? "border-red-500" : "border-white/10"
                      } bg-black/40 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                    />
                    {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Describe your resource, what it covers, and how it can be used..."
                      className={`w-full rounded-lg border ${
                        errors.description ? "border-red-500" : "border-white/10"
                      } bg-black/40 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none`}
                    />
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-400">{errors.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {formData.description.length}/2000 characters
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Classification */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs text-cyan-400">
                    2
                  </span>
                  Classification
                </h2>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Category */}
                  <div>
                    <label
                      htmlFor="category"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Category <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className={`w-full rounded-lg border ${
                        errors.category ? "border-red-500" : "border-white/10"
                      } bg-black/40 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none cursor-pointer`}
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="mt-1 text-sm text-red-400">{errors.category}</p>
                    )}
                  </div>

                  {/* Grade Level */}
                  <div>
                    <label
                      htmlFor="gradeLevel"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Grade Level <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="gradeLevel"
                      name="gradeLevel"
                      value={formData.gradeLevel}
                      onChange={handleChange}
                      className={`w-full rounded-lg border ${
                        errors.gradeLevel ? "border-red-500" : "border-white/10"
                      } bg-black/40 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none cursor-pointer`}
                    >
                      <option value="">Select level</option>
                      {GRADE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                    {errors.gradeLevel && (
                      <p className="mt-1 text-sm text-red-400">{errors.gradeLevel}</p>
                    )}
                  </div>

                  {/* Resource Type */}
                  <div>
                    <label
                      htmlFor="resourceType"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Type <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="resourceType"
                      name="resourceType"
                      value={formData.resourceType}
                      onChange={handleChange}
                      className={`w-full rounded-lg border ${
                        errors.resourceType ? "border-red-500" : "border-white/10"
                      } bg-black/40 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none cursor-pointer`}
                    >
                      <option value="">Select type</option>
                      {RESOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.resourceType && (
                      <p className="mt-1 text-sm text-red-400">{errors.resourceType}</p>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-4">
                  <label htmlFor="tags" className="block text-sm font-medium text-slate-300 mb-2">
                    Tags <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="e.g., biology, plants, science, elementary"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Separate tags with commas to help others find your resource
                  </p>
                </div>
              </div>

              {/* Section 3: File Upload */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs text-cyan-400">
                    3
                  </span>
                  Upload File
                  <span className="text-slate-500 text-sm font-normal">(optional)</span>
                </h2>

                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    fileError
                      ? "border-red-500/50 bg-red-500/5"
                      : file
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-white/20 hover:border-cyan-500/50"
                  }`}
                >
                  {file ? (
                    <div className="flex flex-col items-center">
                      <FileText className="h-12 w-12 text-green-400 mb-3" />
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-slate-400 text-sm">{formatFileSize(file.size)}</p>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="mt-3 text-sm text-red-400 hover:text-red-300"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-12 w-12 text-slate-400 mb-3" />
                      <p className="text-white font-medium mb-1">
                        Drop your file here or click to browse
                      </p>
                      <p className="text-slate-400 text-sm">
                        PDF, DOC, PPTX, XLSX, MP4, or images up to 50MB
                      </p>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept={ALLOWED_TYPES.join(",")}
                      />
                    </div>
                  )}
                </div>
                {fileError && <p className="mt-2 text-sm text-red-400">{fileError}</p>}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Link href="/browse">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 min-w-[140px]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Resource"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 mt-auto bg-slate-950/80 backdrop-blur">
        <div className="container text-center text-sm text-slate-400">
          <p>&copy; 2025 Apex Commons. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
