// api/cancel/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyUser } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    const uid = verification.user!.uid;

    try {
        const { bookingId } = await request.json();
        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        
        const doc = await bookingRef.get();
        if (!doc.exists) {
            return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
        }

        const bookingData = doc.data()!;
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const isAdmin = userDoc.exists && userDoc.data()?.isAdmin;

        // Condition 1: Not the owner and not an admin. REJECT.
        if (bookingData.userId !== uid && !isAdmin) {
            return NextResponse.json({ success: false, message: 'Not authorized to cancel this booking' }, { status: 403 });
        }

        // Condition 2: Is the owner, but NOT an admin. Check time limit.
        if (bookingData.userId === uid && !isAdmin) {
            const createdAt = bookingData.createdAt.toDate();
            const now = new Date();
            const oneHour = 60 * 60 * 1000;

            if (now.getTime() - createdAt.getTime() > oneHour) {
                return NextResponse.json({ success: false, message: 'The 1-hour grace period for cancellation has passed.' }, { status: 403 });
            }
        }
        // If the user IS an admin, they bypass the time check.

        await bookingRef.delete();
        return NextResponse.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}