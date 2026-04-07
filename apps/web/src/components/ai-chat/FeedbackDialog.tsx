import React, { useState, useRef } from 'react';
import { X, Upload, Check, AlertCircle, Loader2, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FeedbackData) => Promise<void>;
  messageId: string;
}

export interface FeedbackData {
  category: string;
  whatWentWrong: string;
  additionalContent: string;
  attachment: File | null;
}

const CATEGORIES = [
  'SSG News',
  'NEO SSG Training',
  'OCM',
  'SSG Processes & Models',
  'Concord-HBB',
  'Finance DOA',
  'EaaS Training',
  'SSG Service Ops'
];

export function FeedbackDialog({ isOpen, onClose, onSubmit }: Omit<FeedbackDialogProps, 'messageId'>) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [additionalContent, setAdditionalContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen && !isSubmitting && !success) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !whatWentWrong) {
      setError(t('feedback.requiredFields'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        category,
        whatWentWrong,
        additionalContent,
        attachment
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCategory('');
    setWhatWentWrong('');
    setAdditionalContent('');
    setAttachment(null);
    setSuccess(false);
    setError(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAttachment(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-lg bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Submit Prompt Feedback</h2>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <Maximize2 className="h-4 w-4" />
            </button>
            <button onClick={handleClose} className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in zoom-in-90 duration-500">
              <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-lg font-medium">Feedback submitted successfully!</p>
              <p className="text-sm text-muted-foreground text-center px-8">
                Thank you for your feedback. We will use it to improve our services.
              </p>
            </div>
          ) : (
            <>
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <span className="text-red-500">*</span> What type of Category do you wish to report bug on ? (choose)
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 appearance-none transition-all"
                  >
                    <option value="" disabled>Please make your choice</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none border-l pl-2 border-border/40">
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* What went wrong */}
              <div className="space-y-2">
                <label className="text-sm font-medium">What went wrong? (detail comments)</label>
                <div className="relative group">
                  <textarea
                    value={whatWentWrong}
                    onChange={(e) => setWhatWentWrong(e.target.value)}
                    placeholder="Feel free to add specific details"
                    maxLength={500}
                    className="w-full h-28 bg-background border border-border/60 rounded-xl px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all resize-none scrollbar-thin"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground font-mono">
                    {whatWentWrong.length} / 500
                  </div>
                </div>
              </div>

              {/* Additional content */}
              <div className="space-y-2">
                <label className="text-sm font-medium">If you have any additional content, please share in the box below</label>
                <div className="relative group">
                  <textarea
                    value={additionalContent}
                    onChange={(e) => setAdditionalContent(e.target.value)}
                    placeholder="knowledge correction and supplementation, etc."
                    maxLength={2000}
                    className="w-full h-24 bg-background border border-border/60 rounded-xl px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all resize-none scrollbar-thin"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground font-mono">
                    {additionalContent.length} / 2000
                  </div>
                </div>
              </div>

              {/* Attachment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attachment (upload screenshots, or references)</label>
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 ${dragActive ? 'border-violet-500 bg-violet-500/5' : 'border-border/60 hover:border-border/100 bg-muted/20'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  
                  {attachment ? (
                    <div className="flex items-center justify-between bg-background p-2.5 rounded-lg border border-border/40 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 flex-shrink-0 bg-violet-500/10 rounded flex items-center justify-center">
                          <Upload className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{attachment.name}</span>
                          <span className="text-[10px] text-muted-foreground">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2 space-y-2 text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="h-10 w-10 bg-muted/50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Screenshots or documents (Max 10MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm animate-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tips */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <AlertCircle className="inline h-3 w-3 mr-1 align-top mt-0.5" />
                After submission, your feedback will be used to improve products and services, and administrators will be able to view and manage your feedback data.
              </p>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl border border-border/60 hover:bg-accent text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !category || !whatWentWrong}
                  className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 disabled:shadow-none transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
