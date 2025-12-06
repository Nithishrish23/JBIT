
import React, { useState } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function UserSupport() {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("Sending...");
    api.post("/api/support/contact", { subject, message })
      .then(() => {
        setStatus("Your message has been sent successfully!");
        setSubject("");
        setMessage("");
        setTimeout(() => { setShowEmailForm(false); setStatus(""); }, 2000);
      })
      .catch(() => {
        setStatus("Failed to send message. Please try again later.");
      });
  };

  return (
    <>
      <Helmet>
        <title>Support & Help</title>
      </Helmet>
      <div className="font-display bg-[#FFF7F2] min-h-screen text-[#2D2620] py-8 px-4">
        <div className="max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col items-center gap-3 text-center mb-8">
                <p className="text-4xl font-black leading-tight tracking-tight">Help Center</p>
                <p className="text-[#705C4B] text-base font-normal">How can we help you today?</p>
            </div>

            {/* Search */}
            <div className="max-w-2xl mx-auto mb-8">
                <div className="flex w-full items-stretch rounded-lg h-12 bg-[#FDF0E6] border border-[#EADFD6]">
                    <div className="text-[#705C4B] flex items-center justify-center pl-4">
                        <span className="material-symbols-outlined">search</span>
                    </div>
                    <input className="flex w-full bg-transparent border-none h-full px-4 text-base focus:outline-none placeholder-[#705C4B]" placeholder="Search for topics, questions..." />
                </div>
            </div>

            {/* Topics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-12">
                {[
                    { icon: 'shopping_cart', title: 'Ordering & Payments', desc: 'Placing an order, payment methods, promo codes.' },
                    { icon: 'local_shipping', title: 'Shipping & Delivery', desc: 'Shipping times, tracking orders, delivery policies.' },
                    { icon: 'assignment_return', title: 'Returns & Refunds', desc: 'The process for returning products and getting refunds.' },
                    { icon: 'account_circle', title: 'Account & Profile', desc: 'Managing account details, passwords, and order history.' },
                    { icon: 'info', title: 'Product Information', desc: 'Specifics about our diverse range of products.' }
                ].map((topic, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-3 rounded-xl border border-[#EADFD6] bg-[#FFF7F2] p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
                        <div className="text-[#E57A44]">
                            <span className="material-symbols-outlined !text-3xl">{topic.icon}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-base font-bold leading-tight">{topic.title}</h2>
                            <p className="text-[#705C4B] text-sm font-normal">{topic.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <div className="max-w-3xl mx-auto mb-12">
                <h2 className="text-2xl font-bold leading-tight tracking-tight mb-4 px-4">Frequently Asked Questions</h2>
                <div className="flex flex-col divide-y divide-[#EADFD6] px-4">
                    <details className="group py-4">
                        <summary className="flex cursor-pointer items-center justify-between font-medium">
                            How do I track my order?
                            <span className="material-symbols-outlined transition-transform duration-300 group-open:rotate-180">expand_more</span>
                        </summary>
                        <p className="mt-2 text-[#705C4B] text-sm">Once your order has shipped, you will receive an email with a tracking number and a link to the carrier's website. You can also find tracking information in your account's order history.</p>
                    </details>
                    <details className="group py-4">
                        <summary className="flex cursor-pointer items-center justify-between font-medium">
                            What is your return policy?
                            <span className="material-symbols-outlined transition-transform duration-300 group-open:rotate-180">expand_more</span>
                        </summary>
                        <p className="mt-2 text-[#705C4B] text-sm">We accept returns within 30 days of purchase for a full refund. Items must be in their original condition. Please visit our Returns & Refunds section for detailed instructions.</p>
                    </details>
                    <details className="group py-4">
                        <summary className="flex cursor-pointer items-center justify-between font-medium">
                            Can I change or cancel my order?
                            <span className="material-symbols-outlined transition-transform duration-300 group-open:rotate-180">expand_more</span>
                        </summary>
                        <p className="mt-2 text-[#705C4B] text-sm">If you need to change or cancel your order, please contact us as soon as possible. We can't guarantee changes once the order is processed, but we'll do our best to help.</p>
                    </details>
                </div>
            </div>

            {/* Still Need Help */}
            <div className="max-w-5xl mx-auto">
                <h2 className="text-center text-2xl font-bold leading-tight tracking-tight mb-6">Still need help?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center gap-3 rounded-xl p-6 text-center bg-[#FDF0E6]">
                        <span className="material-symbols-outlined !text-3xl text-[#E57A44]">chat</span>
                        <h3 className="text-lg font-bold">Chat with an Agent</h3>
                        <p className="text-sm text-[#705C4B]">Get instant answers from our support team.</p>
                        <button className="mt-2 w-full max-w-xs rounded-lg h-10 px-4 bg-[#E57A44] text-[#FFF7F2] text-sm font-bold hover:bg-[#E57A44]/90">Start Chat</button>
                    </div>
                    <div className="flex flex-col items-center gap-3 rounded-xl p-6 text-center bg-[#FDF0E6]">
                        <span className="material-symbols-outlined !text-3xl text-[#E57A44]">email</span>
                        <h3 className="text-lg font-bold">Email Us</h3>
                        <p className="text-sm text-[#705C4B]">We'll get back to you within 24 hours.</p>
                        <button onClick={() => setShowEmailForm(true)} className="mt-2 w-full max-w-xs rounded-lg h-10 px-4 bg-[#E57A44] text-[#FFF7F2] text-sm font-bold hover:bg-[#E57A44]/90">Send Email</button>
                    </div>
                    <div className="flex flex-col items-center gap-3 rounded-xl p-6 text-center bg-[#FDF0E6]">
                        <span className="material-symbols-outlined !text-3xl text-[#E57A44]">call</span>
                        <h3 className="text-lg font-bold">Call Support</h3>
                        <p className="text-sm text-[#705C4B]">Mon-Fri, 9am-5pm EST</p>
                        <a href="tel:+18005551234" className="mt-2 text-[#E57A44] font-bold">+1 (800) 555-1234</a>
                    </div>
                </div>
            </div>
        </div>

        {/* Email Form Modal */}
        {showEmailForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
                    <button onClick={() => setShowEmailForm(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <h2 className="text-xl font-bold mb-4">Send us a message</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Subject</label>
                            <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Message</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" rows="4" required></textarea>
                        </div>
                        <button type="submit" className="w-full bg-[#E57A44] text-white rounded py-2 text-sm font-bold hover:bg-[#E57A44]/90">
                            Send Message
                        </button>
                        {status && <p className="text-sm text-center mt-2 text-[#E57A44]">{status}</p>}
                    </form>
                </div>
            </div>
        )}

      </div>
    </>
  );
}
