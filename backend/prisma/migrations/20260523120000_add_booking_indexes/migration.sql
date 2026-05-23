-- AddIndex: Ottimizzazione query per data di pickup (filtri temporali e ordinamento)
CREATE INDEX "Booking_pickupAt_idx" ON "Booking"("pickupAt");

-- AddIndex: Ottimizzazione query per agenzia (filtro prenotazioni per agenzia)
CREATE INDEX "Booking_agencyId_idx" ON "Booking"("agencyId");

-- AddIndex: Ottimizzazione cron job notifiche driver (query ogni minuto)
CREATE INDEX "Booking_driverId_driverNotified_idx" ON "Booking"("driverId", "driverNotified");
