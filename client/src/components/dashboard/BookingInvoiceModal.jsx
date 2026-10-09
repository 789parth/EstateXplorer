import React, { useState, useEffect } from 'react';
import { X, Printer, Download, CheckCircle2, Building2, User, Phone, Mail, Calendar, CreditCard, ShieldCheck } from 'lucide-react';
import { getBookingInvoiceApi } from '../../services/bookingService';
import { formatPrice } from '../../utils/formatters';

const BookingInvoiceModal = ({ isOpen, onClose, bookingId }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setInvoice(null);
      setError('');
      return;
    }

    const fetchInvoice = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getBookingInvoiceApi(bookingId);
        if (res.success && res.data) {
          setInvoice(res.data);
        } else {
          setError(res.message || 'Unable to load invoice.');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch invoice details.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 text-left max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top bar with actions (hidden on print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Official Token Payment Invoice</h3>
              <p className="text-[11px] text-slate-500">Generated for property holder and buyer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice && (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Printer size={13} />
                <span>Print / Download PDF</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 text-slate-800 space-y-6">
          {loading && (
            <div className="text-center py-12 text-slate-500 text-xs">
              Loading official booking invoice...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          {invoice && (
            <div className="space-y-6" id="invoice-printable-area">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-slate-800">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">EstateXplorer</h2>
                  <p className="text-xs text-slate-500 font-medium">Digital Real Estate Booking Receipt &amp; Token Invoice</p>
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">Issued By: </span>
                    <span className="font-bold text-slate-900">{invoice.issuer?.name}</span>
                    {invoice.issuer?.reraNumber && (
                      <span className="text-[11px] text-slate-500 block">RERA: {invoice.issuer.reraNumber}</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
                    {invoice.paymentStatus || 'Token Paid'}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">{invoice.invoiceNumber}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Booking Ref: {invoice.bookingNumber}</div>
                  <div className="text-[11px] text-slate-500">
                    Date: {new Date(invoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Parties Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Buyer Details
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{invoice.buyer?.name}</div>
                  {invoice.buyer?.phone && (
                    <div className="text-slate-600 flex items-center gap-1 mt-1">
                      <Phone size={11} className="text-slate-400" /> {invoice.buyer.phone}
                    </div>
                  )}
                  {invoice.buyer?.email && (
                    <div className="text-slate-600 flex items-center gap-1 mt-0.5">
                      <Mail size={11} className="text-slate-400" /> {invoice.buyer.email}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Project / Property Details
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{invoice.project?.title}</div>
                  <div className="text-slate-600 mt-1">
                    {typeof invoice.project?.location === 'string'
                      ? invoice.project.location
                      : `${invoice.project?.location?.address || ''}, ${invoice.project?.location?.city || ''}`}
                  </div>
                  {invoice.agent && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-emerald-700 flex items-center gap-1">
                      <ShieldCheck size={12} />
                      <span>Attributed Agent: <strong>{invoice.agent.agencyName || invoice.agent.name}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Unit Specifications Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Booked Inventory Unit</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tower</th>
                        <th className="py-2.5 px-3">Unit / Flat</th>
                        <th className="py-2.5 px-3">Floor</th>
                        <th className="py-2.5 px-3">Configuration</th>
                        <th className="py-2.5 px-3">Carpet Area</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      <tr>
                        <td className="py-2.5 px-3">{invoice.unit?.tower}</td>
                        <td className="py-2.5 px-3 font-bold">{invoice.unit?.unitNumber}</td>
                        <td className="py-2.5 px-3">{invoice.unit?.floor}</td>
                        <td className="py-2.5 px-3">{invoice.unit?.bhk} BHK</td>
                        <td className="py-2.5 px-3">{invoice.unit?.carpetArea}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakup */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Total Agreed Property Value:</span>
                  <span className="font-bold text-slate-900">{formatPrice(invoice.pricing?.agreementValue)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 font-bold py-1 border-y border-slate-200">
                  <span>Token Amount Received (Paid):</span>
                  <span>{formatPrice(invoice.pricing?.tokenAmountPaid)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 font-semibold pt-1">
                  <span>Balance Due upon Agreement:</span>
                  <span className="text-slate-900">{formatPrice(invoice.pricing?.balanceDue)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Payment Method:</span>
                  <strong className="text-slate-800">{invoice.payment?.method}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Transaction Reference:</span>
                  <strong className="text-slate-800 font-mono">{invoice.payment?.transactionRef}</strong>
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 text-center">
                This is a computer-generated token payment invoice generated through EstateXplorer. A valid site visit was completed prior to locking this inventory unit.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingInvoiceModal;
