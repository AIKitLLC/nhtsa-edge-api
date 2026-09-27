-- Decode functions from the official NHTSA vPICList_lite_2026_09 PostgreSQL dump (public domain).
-- Kept verbatim as the reference for src/vpic/*. Do not edit; replace when NHTSA changes them.

--
-- TOC entry 432 (class 1255 OID 6697914)
-- Name: felementattributevalue(integer, character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.felementattributevalue(elementid integer, attributeid character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	v varchar(2000) = AttributeId;
begin
	CASE ElementId
        WHEN 2 THEN
			select name from vpic.BatteryType where cast(Id as character varying) = AttributeId into v;
			return v;
		
        WHEN 3 THEN
			select name from vpic.BedType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 4 THEN
			select name from vpic.BodyCab where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 5 THEN
			select name from vpic.BodyStyle where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 10 THEN
			select name from vpic.DestinationMarket where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 15 THEN
			select name from vpic.DriveType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 23 THEN
			select name from vpic.EntertainmentSystem where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 24 THEN
			select name from vpic.FuelType where cast(Id as character varying) = AttributeId into v;
			return v;
			
		WHEN 25 THEN
			select name from vpic.GrossVehicleWeightRating where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 26 THEN
			select name from vpic.Make where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 27 THEN
			select name from vpic.Manufacturer where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 28 THEN
			select name from vpic.Model where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 36 THEN
			select name from vpic.Steering where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 37 THEN
			select name from vpic.Transmission where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 39 THEN
			select name from vpic.VehicleType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 42 THEN
			select name from vpic.BrakeSystem where cast(Id as character varying) = AttributeId into v;
			return v;
			
		WHEN 55 THEN
			select name from vpic.AirBagLocations where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 56 THEN
			select name from vpic.AirBagLocations where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 60 THEN
			select name from vpic.WheelBaseType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 62 THEN
			select name from vpic.ValvetrainDesign where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 64 THEN
			select name from vpic.EngineConfiguration where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 65 THEN
			select name from vpic.AirBagLocFront where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 66 THEN
			select name from vpic.FuelType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 67 THEN
			select name from vpic.FuelDeliveryType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 69 THEN
			select name from vpic.AirBagLocKnee where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 72 THEN
			select name from vpic.EVDriveUnit where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 75 THEN
			select name from vpic.Country where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 78 THEN
			select name from vpic.Pretensioner where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 79 THEN
			select name from vpic.SeatBeltsAll where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 81 THEN
			select name from vpic.AdaptiveCruiseControl where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 86 THEN
			select name from vpic.ABS where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 87 THEN
			select name from vpic.AutoBrake where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 88 THEN
			select name from vpic.BlindSpotMonitoring where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 96 THEN
			select name from vpic.vNCSABodyType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 97 THEN
			select name from vpic.vNCSAMake where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 98 THEN
			select name from vpic.vNCSAModel where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 99 THEN
			select name from vpic.ECS where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 100 THEN
			select name from vpic.TractionControl where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 101 THEN
			select name from vpic.ForwardCollisionWarning where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 102 THEN
			select name from vpic.LaneDepartureWarning where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 103 THEN
			select name from vpic.LaneKeepSystem where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 104 THEN
			select name from vpic.RearVisibilityCamera where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 105 THEN
			select name from vpic.ParkAssist where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 107 THEN
			select name from vpic.AirBagLocations where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 116 THEN
			select name from vpic.TrailerType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 117 THEN
			select name from vpic.TrailerBodyType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 122 THEN
			select name from vpic.CoolingType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 126 THEN
			select name from vpic.ElectrificationLevel where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 127 THEN
			select name from vpic.ChargerLevel where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 135 THEN
			select name from vpic.Turbo where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 143 THEN
			select name from vpic.ErrorCode where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 145 THEN
			select name from vpic.AxleConfiguration where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 148 THEN
			select name from vpic.BusFloorConfigType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 149 THEN
			select name from vpic.BusType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 151 THEN
			select name from vpic.CustomMotorcycleType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 152 THEN
			select name from vpic.MotorcycleSuspensionType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 153 THEN
			select name from vpic.MotorcycleChassisType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 168 THEN
			select name from vpic.TPMS where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 170 THEN
			select name from vpic.DynamicBrakeSupport where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 171 THEN
			select name from vpic.PedestrianAutomaticEmergencyBraking where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 172 THEN
			select name from vpic.AutoReverseSystem where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 173 THEN
			select name from vpic.AutomaticPedestrainAlertingSound where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 174 THEN
			select name from vpic.CAN_AACN where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 175 THEN
			select name from vpic.EDR where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 176 THEN
			select name from vpic.KeylessIgnition where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 177 THEN
			select name from vpic.DaytimeRunningLight where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 178 THEN
			select name from vpic.LowerBeamHeadlampLightSource where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 179 THEN
			select name from vpic.SemiautomaticHeadlampBeamSwitching where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 180 THEN
			select name from vpic.AdaptiveDrivingBeam where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 183 THEN
			select name from vpic.RearCrossTrafficAlert where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 184 THEN
			select name from vpic.GrossVehicleWeightRating where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 185 THEN
			select name from vpic.GrossVehicleWeightRating where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 190 THEN
			select name from vpic.GrossVehicleWeightRating where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 192 THEN
			select name from vpic.RearAutomaticEmergencyBraking where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 193 THEN
			select name from vpic.BlindSpotIntervention where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 194 THEN
			select name from vpic.LaneCenteringAssistance where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 195 THEN
			select name from vpic.NonLandUse where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 200 THEN
			select name from vpic.FuelTankType where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 201 THEN
			select name from vpic.FuelTankMaterial where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 202 THEN
			select name from vpic.CombinedBrakingSystem where cast(Id as character varying) = AttributeId into v;
			return v;

		WHEN 203 THEN
			select name from vpic.WheelieMitigation where cast(Id as character varying) = AttributeId into v;
			return v;
	ELSE
		return v;
    END CASE;

	return v;
end;
$$;


--
-- TOC entry 433 (class 1255 OID 6697915)
-- Name: ferrorvalue(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.ferrorvalue(str character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
	w int = 0;
begin
	SELECT SUM(weight)
    INTO w
    FROM vpic.ErrorCode
    WHERE POSITION(',' || id::VARCHAR || ',' IN ',' || str || ',') > 0;

    RETURN COALESCE(w, 0);
end;
$$;


--
-- TOC entry 434 (class 1255 OID 6697916)
-- Name: fextractvalidcharsperwmiyear(character varying, smallint); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fextractvalidcharsperwmiyear(input_wmi character varying, year smallint) RETURNS TABLE(p smallint, c character)
    LANGUAGE plpgsql
    AS $$
declare
	keys varchar(50);
	DECLARE cursor_wmiy CURSOR FOR
		SELECT distinct p.Keys
		FROM 
			vpic.Wmi AS w 
			INNER JOIN vpic.Wmi_VinSchema AS wvs ON w.Id = wvs.WmiId 
			INNER JOIN vpic.VinSchema AS vs ON wvs.VinSchemaId = vs.Id 
			INNER JOIN vpic.Pattern AS p ON vs.Id = p.VinSchemaId
		WHERE     
			(w.Wmi = input_wmi)
			and year between wvs.YearFrom and COALESCE(wvs.YearTo, 2999);
begin
    create temporary table IF NOT EXISTS tbl_fExtractValidCharsPerWmiYear (
        p smallint,
        c char(1)
    ) on commit drop;
	
	OPEN cursor_wmiy;

	LOOP
		FETCH NEXT FROM cursor_wmiy INTO keys;
		
		EXIT WHEN NOT FOUND;

		insert into tbl_fExtractValidCharsPerWmiYear(p, c) select pos + 3, return_chr from vpic.fValidCharsInKey(keys);
	END LOOP;

	CLOSE cursor_wmiy;
	
	return query select * from tbl_fExtractValidCharsPerWmiYear;
	drop table tbl_fExtractValidCharsPerWmiYear;
end;
$$;


--
-- TOC entry 435 (class 1255 OID 6697917)
-- Name: fvalidcharsinkey(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvalidcharsinkey(str character varying) RETURNS TABLE(pos integer, return_chr character)
    LANGUAGE plpgsql
    AS $$
declare
	validchars varchar(50) = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
	strct boolean = true;
	n int = length(str);
	s char(1);
	inside boolean = false;
	ind int = 0;
	i int = 0;
	start int = 0;
	j smallint = 0;
	chars varchar(50);
	pattern varchar(50);
begin
    create temporary table IF NOT EXISTS tbl_fvalidcharsinkey (
        pos int,
        return_chr char(1)
    ) on commit drop;
	
    while i < n loop
		i = i + 1;
		s = SUBSTRING(str, i, 1);

		if s = '[' and inside = false then
		    inside = true;
			start = i;
			continue;
		end if;
	
		if inside = false then
			ind = ind + 1;

			if s = '#' then
				insert into tbl_fvalidcharsinkey values (ind, '0');
				insert into tbl_fvalidcharsinkey values (ind, '1');
				insert into tbl_fvalidcharsinkey values (ind, '2');
				insert into tbl_fvalidcharsinkey values (ind, '3');
				insert into tbl_fvalidcharsinkey values (ind, '4');
				insert into tbl_fvalidcharsinkey values (ind, '5');
				insert into tbl_fvalidcharsinkey values (ind, '6');
				insert into tbl_fvalidcharsinkey values (ind, '7');
				insert into tbl_fvalidcharsinkey values (ind, '8');
				insert into tbl_fvalidcharsinkey values (ind, '9');
				continue;
			end if;
	
			if s = '*' then
				if strct = false then
					chars = validchars;
					j = 0;
					while j < length(chars) loop
						j = j + 1;
						s = SUBSTRING (chars, j, 1);
						insert into tbl_fvalidcharsinkey values (ind, s);
					end loop;
				end if;
				continue;
			end if;
				
			insert into tbl_fvalidcharsinkey values (ind, s);
			continue;
		end if;
	
		if s = ']' and inside = true then
			ind = ind + 1;
			pattern = substring(str, start, i - start + 1);

			chars = vpic.fValidCharsInRegEx(pattern);
			j = 0;
			while j < length(chars) loop
				j = j + 1;
				s = SUBSTRING(chars, j, 1);
				if s <> '*' and s <> '|' then
					insert into tbl_fvalidcharsinkey values (ind, s);
				end if;
			end loop;
			
			inside = false;
			start = 0;
			continue;
		end if;
	end loop;
	
    return query select * from tbl_fvalidcharsinkey;
	drop table tbl_fvalidcharsinkey;
end;
$$;


--
-- TOC entry 436 (class 1255 OID 6697918)
-- Name: fvalidcharsinregex(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvalidcharsinregex(str character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $_$
declare
	validchars varchar(50) =  'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
	result varchar(50) = '';
	i int = 0;
	n int = length(validchars);
	s char(1);
	pattern text;
begin
	str = upper(str);

	if strpos(str, '-') = 0 and strpos(str, '^') = 0 then
		return replace(replace(str, ']', ''), '[', '');
	end if;

	pattern := '^' || str || '$';
	
	while i < n loop
		i = i + 1;
		s = SUBSTRING(validchars, i, 1);
		
		if s ~ pattern then
			result = result || s;
		end if;
	end loop;
	
	return result;
end;
$_$;


--
-- TOC entry 420 (class 1255 OID 6697919)
-- Name: fvincheckdigit(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvincheckdigit(strvin character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	TempString VARCHAR(4) = '';
	sVINChar VARCHAR(1) = '';
	patternDefault VARCHAR(50)		= '[a-h,j-n,p,r-z,0-9]';
	patternMY VARCHAR(50)			= '[a-h,j-n,p,r-t,v-y,1-9]';
	patternNumbersOnly VARCHAR(50)	= '[0-9]';
	pattern VARCHAR(50);
	temp REAL;
    TempDigit REAL = 0;
    CalcDigit REAL = 0;
	CalcTemp INT = 0;
	i INT;
	valid boolean;
begin

	i = 1;
	if length(strVin) = 17 then
		CalcDigit = 0;

		while i <= length(strVIN) loop
			sVINChar = SUBSTRING(strVIN, i, 1);

			CASE
		        WHEN i = 10 THEN
					pattern = patternMY;
				WHEN i in (13, 14) and SUBSTRING(strVIN, 3, 1) = '9' THEN
					pattern = patternDefault;
				WHEN i in (13, 14) and SUBSTRING(strVIN, 3, 1) <> '9' THEN
					pattern = patternNumbersOnly;
				WHEN i >= 15 THEN
					pattern = patternNumbersOnly;
			ELSE
				pattern = patternDefault;
			END CASE;

			if not sVINChar ~* pattern then
				return '?';
			end if;

			CASE sVINChar
				WHEN '0' THEN CalcTemp = 0;
				WHEN '1' THEN CalcTemp = 1;
				WHEN '2' THEN CalcTemp = 2;
				WHEN '3' THEN CalcTemp = 3;
				WHEN '4' THEN CalcTemp = 4;
				WHEN '5' THEN CalcTemp = 5;
				WHEN '6' THEN CalcTemp = 6;
				WHEN '7' THEN CalcTemp = 7;
				WHEN '8' THEN CalcTemp = 8;
				WHEN '9' THEN CalcTemp = 9;
				WHEN 'A' THEN CalcTemp = 1;
				WHEN 'B' THEN CalcTemp = 2;
				WHEN 'C' THEN CalcTemp = 3;
				WHEN 'D' THEN CalcTemp = 4;
				WHEN 'E' THEN CalcTemp = 5;
				WHEN 'F' THEN CalcTemp = 6;
				WHEN 'G' THEN CalcTemp = 7;
				WHEN 'H' THEN CalcTemp = 8;
				WHEN 'J' THEN CalcTemp = 1;
				WHEN 'K' THEN CalcTemp = 2;
				WHEN 'L' THEN CalcTemp = 3;
				WHEN 'M' THEN CalcTemp = 4;
				WHEN 'N' THEN CalcTemp = 5;
				WHEN 'P' THEN CalcTemp = 7;
				WHEN 'R' THEN CalcTemp = 9;
				WHEN 'S' THEN CalcTemp = 2;
				WHEN 'T' THEN CalcTemp = 3;
				WHEN 'U' THEN CalcTemp = 4;
				WHEN 'V' THEN CalcTemp = 5;
				WHEN 'W' THEN CalcTemp = 6;
				WHEN 'X' THEN CalcTemp = 7;
				WHEN 'Y' THEN CalcTemp = 8;
				WHEN 'Z' THEN CalcTemp = 9;
			ELSE
				CalcTemp = -1;
			END CASE;

			CASE i
				WHEN 1 THEN CalcDigit = CalcDigit + (CalcTemp * 8);
				WHEN 2 THEN CalcDigit = CalcDigit + (CalcTemp * 7);
				WHEN 3 THEN CalcDigit = CalcDigit + (CalcTemp * 6);
				WHEN 4 THEN CalcDigit = CalcDigit + (CalcTemp * 5);
				WHEN 5 THEN CalcDigit = CalcDigit + (CalcTemp * 4);
				WHEN 6 THEN CalcDigit = CalcDigit + (CalcTemp * 3);
				WHEN 7 THEN CalcDigit = CalcDigit + (CalcTemp * 2);
				WHEN 8 THEN CalcDigit = CalcDigit + (CalcTemp * 10);
				WHEN 9 THEN CalcDigit = CalcDigit;
				WHEN 10 THEN CalcDigit = CalcDigit + (CalcTemp * 9);
				WHEN 11 THEN CalcDigit = CalcDigit + (CalcTemp * 8);
				WHEN 12 THEN CalcDigit = CalcDigit + (CalcTemp * 7);
				WHEN 13 THEN CalcDigit = CalcDigit + (CalcTemp * 6);
				WHEN 14 THEN CalcDigit = CalcDigit + (CalcTemp * 5);
				WHEN 15 THEN CalcDigit = CalcDigit + (CalcTemp * 4);
				WHEN 16 THEN CalcDigit = CalcDigit + (CalcTemp * 3);
				WHEN 17 THEN CalcDigit = CalcDigit + (CalcTemp * 2);
			ELSE
				CalcDigit = CalcDigit;
			END CASE;

			i = i + 1;
		end loop;

		temp = CalcDigit / 11;
		TempDigit = ROUND(CAST((temp - CAST(floor(temp) AS int)) * 11 as NUMERIC), 2);
		TempString = CAST(TempDigit as VARCHAR(10));
		TempString = CASE LENGTH(TRIM(TempString))
		                	WHEN 1 THEN ' ' || TempString
		                 ELSE TempString
		                 END;
		if TempString = '10' then
			TempString = 'X';
		else
			TempString = SUBSTRING(TempString, 2, 1);
		end if;
	end if;

	return TempString;
end;
$$;


--
-- TOC entry 437 (class 1255 OID 6697920)
-- Name: fvincheckdigit2(character varying, boolean); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvincheckdigit2(strvin character varying, iscarmpvlt boolean) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	TempString VARCHAR(4) = '';
	sVINChar VARCHAR(1) = '';
	patternDefault VARCHAR(50)		= '[a-h,j-n,p,r-z,0-9]';
	patternMY VARCHAR(50)			= '[a-h,j-n,p,r-t,v-y,1-9]';
	patternNumbersOnly VARCHAR(50)	= '[0-9]';
	pattern VARCHAR(50);
	temp REAL;
    TempDigit REAL = 0;
    CalcDigit REAL = 0;
	CalcTemp INT = 0;
	i INT;
	valid boolean;
begin

	i = 1;
	if length(strVin) = 17 then
		CalcDigit = 0;

		while i <= length(strVIN) loop
			sVINChar = SUBSTRING(strVIN, i, 1);

			CASE
		        WHEN i = 10 THEN
					pattern = patternMY;
				WHEN i = 13 and SUBSTRING(strVIN, 3, 1) <> '9' and isCarmpvLT = true THEN
					pattern = patternNumbersOnly;
				WHEN i = 14 and SUBSTRING(strVIN, 3, 1) <> '9' THEN
					pattern = patternNumbersOnly;
				WHEN i >= 15 THEN
					pattern = patternNumbersOnly;
			ELSE
				pattern = patternDefault;
			END CASE;

			if not sVINChar ~* pattern then
				return '?';
			end if;

			CASE sVINChar
				WHEN '0' THEN CalcTemp = 0;
				WHEN '1' THEN CalcTemp = 1;
				WHEN '2' THEN CalcTemp = 2;
				WHEN '3' THEN CalcTemp = 3;
				WHEN '4' THEN CalcTemp = 4;
				WHEN '5' THEN CalcTemp = 5;
				WHEN '6' THEN CalcTemp = 6;
				WHEN '7' THEN CalcTemp = 7;
				WHEN '8' THEN CalcTemp = 8;
				WHEN '9' THEN CalcTemp = 9;
				WHEN 'A' THEN CalcTemp = 1;
				WHEN 'B' THEN CalcTemp = 2;
				WHEN 'C' THEN CalcTemp = 3;
				WHEN 'D' THEN CalcTemp = 4;
				WHEN 'E' THEN CalcTemp = 5;
				WHEN 'F' THEN CalcTemp = 6;
				WHEN 'G' THEN CalcTemp = 7;
				WHEN 'H' THEN CalcTemp = 8;
				WHEN 'J' THEN CalcTemp = 1;
				WHEN 'K' THEN CalcTemp = 2;
				WHEN 'L' THEN CalcTemp = 3;
				WHEN 'M' THEN CalcTemp = 4;
				WHEN 'N' THEN CalcTemp = 5;
				WHEN 'P' THEN CalcTemp = 7;
				WHEN 'R' THEN CalcTemp = 9;
				WHEN 'S' THEN CalcTemp = 2;
				WHEN 'T' THEN CalcTemp = 3;
				WHEN 'U' THEN CalcTemp = 4;
				WHEN 'V' THEN CalcTemp = 5;
				WHEN 'W' THEN CalcTemp = 6;
				WHEN 'X' THEN CalcTemp = 7;
				WHEN 'Y' THEN CalcTemp = 8;
				WHEN 'Z' THEN CalcTemp = 9;
			ELSE
				CalcTemp = -1;
			END CASE;

			CASE i
				WHEN 1 THEN CalcDigit = CalcDigit + (CalcTemp * 8);
				WHEN 2 THEN CalcDigit = CalcDigit + (CalcTemp * 7);
				WHEN 3 THEN CalcDigit = CalcDigit + (CalcTemp * 6);
				WHEN 4 THEN CalcDigit = CalcDigit + (CalcTemp * 5);
				WHEN 5 THEN CalcDigit = CalcDigit + (CalcTemp * 4);
				WHEN 6 THEN CalcDigit = CalcDigit + (CalcTemp * 3);
				WHEN 7 THEN CalcDigit = CalcDigit + (CalcTemp * 2);
				WHEN 8 THEN CalcDigit = CalcDigit + (CalcTemp * 10);
				WHEN 9 THEN CalcDigit = CalcDigit;
				WHEN 10 THEN CalcDigit = CalcDigit + (CalcTemp * 9);
				WHEN 11 THEN CalcDigit = CalcDigit + (CalcTemp * 8);
				WHEN 12 THEN CalcDigit = CalcDigit + (CalcTemp * 7);
				WHEN 13 THEN CalcDigit = CalcDigit + (CalcTemp * 6);
				WHEN 14 THEN CalcDigit = CalcDigit + (CalcTemp * 5);
				WHEN 15 THEN CalcDigit = CalcDigit + (CalcTemp * 4);
				WHEN 16 THEN CalcDigit = CalcDigit + (CalcTemp * 3);
				WHEN 17 THEN CalcDigit = CalcDigit + (CalcTemp * 2);
			ELSE
				CalcDigit = CalcDigit;
			END CASE;

			i = i + 1;
		end loop;

		temp = CalcDigit / 11;
		TempDigit = ROUND(CAST((temp - CAST(floor(temp) AS int)) * 11 as NUMERIC), 2);
		TempString = CAST(TempDigit as VARCHAR(10));
		TempString = CASE LENGTH(TRIM(TempString))
		                	WHEN 1 THEN ' ' || TempString
		                 ELSE TempString
		                 END;
		if TempString = '10' then
			TempString = 'X';
		else
			TempString = SUBSTRING(TempString, 2, 1);
		end if;
	end if;

	return TempString;
end;
$$;


--
-- TOC entry 438 (class 1255 OID 6697921)
-- Name: fvindescriptor(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvindescriptor(vin character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	vehicleDescriptor varchar(17);
begin
	vin = LEFT(TRIM(vin) || '*****************', 17);
	vin = SUBSTRING(vin, 1, 8) || '*' || SUBSTRING(vin, 10);

	vehicleDescriptor = LEFT(vin, 11);
	if SUBSTRING(vin, 3, 1) = '9' then
		vehicleDescriptor = left(vin, 14);
	end if;
	
	return upper(vehicleDescriptor);
end;
$$;


--
-- TOC entry 439 (class 1255 OID 6697922)
-- Name: fvinmodelyear2(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvinmodelyear2(vin character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $_$
declare
	pos10 char(17);
	modelYear int = null;
	conclusive boolean = false;
	var_wmi varchar(6) = null;
	vehicleTypeId int = null;
	truckTypeId int = null;
	carLT int = 0;
begin
	vin = upper(vin);

	if length(vin) >= 10 then
		pos10 = substring(vin, 10, 1);

		if pos10 BETWEEN 'A' AND 'H' THEN
			modelYear = 2010 + ascii(pos10) - ASCII('A');
		end if;

		if pos10 BETWEEN 'J' AND 'N' THEN
			modelYear = 2010 + ascii(pos10) - ASCII('A') -1;
		end if;

		if pos10 = 'P' THEN
			modelYear = 2023;
		end if;

		if pos10 BETWEEN 'R' AND 'T' THEN
			modelYear = 2010 + ascii(pos10) - ASCII('A') -3;
		end if;

		if pos10 BETWEEN 'V' AND 'Y' THEN
			modelYear = 2010 + ascii(pos10) - ASCII('A') -4;
		end if;

		if pos10 BETWEEN '1' AND '9' THEN
			modelYear = 2031 + ascii(pos10) - ASCII('1');
		end if;
	end if;

	if modelYear is not null then
		var_wmi = vpic.fVinWMI(vin);
		if var_wmi is not null then
			select vpic.Wmi.vehicleTypeId, vpic.Wmi.truckTypeId into vehicleTypeId, truckTypeId from vpic.Wmi where vpic.Wmi.wmi = var_wmi;

			if vehicleTypeId in (2, 7) or (vehicleTypeId = 3 and truckTypeId = 1) then
				carLT = 1;
			end if;

			if (carLT = 1) and (substring(vin, 7, 1) ~ '^[0-9]$') then
				modelYear = modelYear - 30;
				conclusive = true;
			end if;

			if (carLT = 1) and (substring(vin, 7, 1) ~ '^[A-Z]$') then
				conclusive = true;
			end if;

			if modelYear > EXTRACT(YEAR FROM (NOW() + INTERVAL '2 years')) then
				modelYear = modelYear - 30;
				conclusive = true;
			end if;
		end if;
	end if;

	if conclusive <> true then
		modelYear = - modelYear;
	end if;
	
	return modelYear;
end;
$_$;


--
-- TOC entry 440 (class 1255 OID 6697923)
-- Name: fvinwmi(character varying); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.fvinwmi(vin character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
declare
	wmi varchar(6);
begin

	if length(vin) > 3 then
		wmi = left(vin, 3);
	else
		wmi = vin;
	end if;

	if substring(wmi, 3, 1) = '9' and length(vin) >= 14 then
		wmi = wmi || substring(vin, 12, 3);
	end if;

	return wmi;
end;
$$;


--
-- TOC entry 442 (class 1255 OID 6697925)
-- Name: spvindecode(character varying, boolean, integer, boolean, boolean); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.spvindecode(v character varying, includeprivate boolean DEFAULT false, year integer DEFAULT NULL::integer, includeall boolean DEFAULT NULL::boolean, nooutput boolean DEFAULT false) RETURNS TABLE(groupname character varying, variable character varying, value character varying, itempatternid integer, itemvinschemaid integer, itemkeys character varying, itemelementid integer, itemattributeid character varying, itemcreatedon timestamp without time zone, itemwmiid integer, code character varying, datatype character varying, decode character varying, itemsource character varying, itemtobeqced boolean)
    LANGUAGE plpgsql
    AS $$
declare
	make varchar(50) = '';
	includeNotPublicilyAvailable boolean = null;
	vin varchar(17) = '';
	modelYear integer;
	modelYearSource varchar(20) = '***X*|Y';
	conclusive boolean = false;
	e12 boolean = false;
	ReturnCode varchar(100) = '';
	var_descriptor varchar(17);
	dmy integer = null;
	rmy integer;
	omy integer;
	do3and4 boolean = true;
	bestPass integer = 0;
	passes integer;
	v_limit integer;
	altMY integer = null;
	cnt1 integer = 0;
	cnt2 integer = 0;
begin

    v_limit = EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '2 years'))::int;

	create temporary table IF NOT EXISTS DecItem (
	        ItemDecodingId integer, ItemCreatedOn timestamp without time zone, ItemPatternId integer,
			ItemKeys character varying(50), ItemVinSchemaId integer, ItemWmiId integer, ItemElementId integer,
			ItemAttributeId character varying(500), ItemValue character varying(500), ItemSource character varying(50), 
			ItemPriority integer, ItemTobeQCed boolean, ReturnCode varchar(100)
	    ) on commit drop;

	var_descriptor = vpic.fVinDescriptor(vin);
	vin = upper(trim(v));
	select vd.ModelYear into dmy from vpic.VinDescriptor vd where vd.Descriptor = var_descriptor;

	if dmy between 1980 and v_limit then
		conclusive = true;
		e12 = 
			CASE
				WHEN year IS NOT NULL and dmy IS NOT NULL and year <> dmy
				THEN true
		        ELSE false
			END;

		insert into DecItem (ItemDecodingId, ItemCreatedOn, ItemPatternId, ItemKeys, ItemVinSchemaId, ItemWmiId, ItemElementId, ItemAttributeId, ItemValue, ItemSource, ItemPriority, ItemTobeQCed, ReturnCode)
		select CoreDecodingId, CoreCreatedOn, CorePatternId, CoreKeys, CoreVinSchemaId, CoreWmiId, CoreElementId, CoreAttributeId, CoreValue, CoreSource, CorePriority, CoreTobeQCed, CoreReturnCode
		from vpic.spvindecode_core(1, dmy, vin, descriptor, conclusive, e12, includeAll, includePrivate, includeNotPublicilyAvailable);

		select di.ReturnCode into ReturnCode from DecItem di order by ItemDecodingId desc limit 1;
	else
		rmy = vpic.fVinModelYear2(upper(vin));
		conclusive = true;
		if rmy < 0 then
			omy = -rmy-30;
			rmy = -rmy;
			conclusive = false;
		end if;

		if conclusive = true then
			if rmy >= 1980 and rmy <= v_limit - 30 then
				altMY = rmy + 30;
			elsif rmy >= 1980 + 30 and rmy <= v_limit then
				altMY = rmy - 30;
			end if;

			if coalesce(altMY, rmy) <> rmy then
				cnt1 = 0;
				cnt2 = 0;
				
				select count(vs.Id) into cnt1
				from vpic.VinSchema vs
				inner join vpic.Wmi_VinSchema as wvs on vs.Id = wvs.VinSchemaId 
				inner join vpic.Wmi as w on wvs.WmiId = w.Id 
				where w.Wmi = vpic.fVinWMI(vin) and (rmy between wvs.YearFrom and coalesce(wvs.YearTo, 2999));

				select count(vs.Id) into cnt2
				from vpic.VinSchema vs
				inner join vpic.Wmi_VinSchema as wvs on vs.Id = wvs.VinSchemaId 
				inner join vpic.Wmi as w on wvs.WmiId = w.Id 
				where w.Wmi = vpic.fVinWMI(vin) and (altMY between wvs.YearFrom and coalesce(wvs.YearTo, 2999));

				if cnt1 = 0 and cnt2 > 0 then
					rmy = altMY;
				end if;
			end if;
		end if;

		if year between 1980 and v_limit then 
			if year = rmy or year = omy then
				do3and4 = true;
			else
				modelYearSource = cast(year as varchar);

				insert into DecItem (ItemDecodingId, ItemCreatedOn, ItemPatternId, ItemKeys, ItemVinSchemaId, ItemWmiId, ItemElementId, ItemAttributeId, ItemValue, ItemSource, ItemPriority, ItemTobeQCed, ReturnCode)
				select CoreDecodingId, CoreCreatedOn, CorePatternId, CoreKeys, CoreVinSchemaId, CoreWmiId, CoreElementId, CoreAttributeId, CoreValue, CoreSource, CorePriority, CoreTobeQCed, CoreReturnCode
				from vpic.spvindecode_core(2, year, vin, modelYearSource, true, true, includeAll, includePrivate, includeNotPublicilyAvailable) r;
		
				select di.ReturnCode into ReturnCode from DecItem di order by ItemDecodingId desc limit 1;
				
				do3and4 = 
					CASE
						WHEN ReturnCode LIKE '% 8 %' AND rmy IS NOT NULL
						THEN true
						ELSE false
			        END;
			end if;
		end if;

		if do3and4 = true then
			e12 = 
				CASE
					WHEN year IS NOT NULL and rmy IS NOT NULL and year <> rmy
					THEN true
			        ELSE false
				END;
			
			insert into DecItem (ItemDecodingId, ItemCreatedOn, ItemPatternId, ItemKeys, ItemVinSchemaId, ItemWmiId, ItemElementId, ItemAttributeId, ItemValue, ItemSource, ItemPriority, ItemTobeQCed, ReturnCode)
			select CoreDecodingId, CoreCreatedOn, CorePatternId, CoreKeys, CoreVinSchemaId, CoreWmiId, CoreElementId, CoreAttributeId, CoreValue, CoreSource, CorePriority, CoreTobeQCed, CoreReturnCode
			from vpic.spvindecode_core(3, rmy, vin, modelYearSource, conclusive, e12, includeAll, includePrivate, includeNotPublicilyAvailable);
			
			select di.ReturnCode into ReturnCode from DecItem di order by ItemDecodingId desc limit 1;
	
			if not omy is null then
				e12 = 
					CASE
						WHEN year IS NOT NULL and omy IS NOT NULL and year <> omy
						THEN true
				        ELSE false
					END;
				
				insert into DecItem (ItemDecodingId, ItemCreatedOn, ItemPatternId, ItemKeys, ItemVinSchemaId, ItemWmiId, ItemElementId, ItemAttributeId, ItemValue, ItemSource, ItemPriority, ItemTobeQCed, ReturnCode)
				select CoreDecodingId, CoreCreatedOn, CorePatternId, CoreKeys, CoreVinSchemaId, CoreWmiId, CoreElementId, CoreAttributeId, CoreValue, CoreSource, CorePriority, CoreTobeQCed, CoreReturnCode
				from vpic.spvindecode_core(4, omy, vin, modelYearSource, conclusive, e12, includeAll, includePrivate, includeNotPublicilyAvailable);

				select di.ReturnCode into ReturnCode from DecItem di order by ItemDecodingId desc limit 1;
			end if;
		end if;
	end if;

	select count(distinct ItemDecodingId) into passes from DecItem;

	create temporary table IF NOT EXISTS x (
	        ItemDecodingId integer, ErrorCodes varchar(100),
			ErrorValue integer, ElementsWeight integer,
			Patterns integer, ModelYear integer
	    ) on commit drop;

	insert into x
	select err.ItemDecodingId, err.ErrorCodes, err.ErrorValue, el.ElementsWeight, p.Patterns, my.ModelYear + my.ModelYearBonus as ModelYear
	from
	(
		select distinct ItemDecodingId
		from DecItem
	) a
	left outer join
	(	
		select d.ItemDecodingId, d.ItemValue as ErrorCodes, vpic.fErrorValue(d.ItemValue) as ErrorValue
		from DecItem d
		where d.ItemElementId = 143
	) err on a.ItemDecodingId = err.ItemDecodingId
	left outer join
	(	
		select ItemDecodingId, sum(weight) as ElementsWeight
		from (
			select distinct ItemDecodingId, d.ItemElementId, e.weight
			from DecItem d inner join vpic.Element e on d.ItemElementId = e.id 
			where coalesce(d.ItemValue, '') <> '' and e.weight is not null
		) t
		group by ItemDecodingId
	) el on err.ItemDecodingId = el.ItemDecodingId
	left outer join
	(	
		select ItemDecodingId, count(*) as Patterns
		from DecItem d 
		where d.ItemSource in ('Pattern', 'EngineModelPattern', 'Formula Pattern') and coalesce(d.ItemValue, '') not in ('', 'Not Applicable')
		group by ItemDecodingId
	) p on err.ItemDecodingId = p.ItemDecodingId
	left outer join
	(	
		select ItemDecodingId, cast(ItemValue as int) as ModelYear, case when year = cast(ItemValue as int) then 10000 else 0 end as ModelYearBonus
		from DecItem d
		where d.ItemElementId = 29
	) my on a.ItemDecodingId = my.ItemDecodingId;

	select ItemDecodingId into bestPass from x order by x.ErrorValue desc, x.ElementsWeight desc, x.Patterns desc, x.ModelYear desc limit 1;
		
	delete from DecItem where ItemDecodingId <> bestPass;

	update DecItem 
	set ItemTobeQCed = vs.TobeQCed
	from DecItem d inner join vpic.VinSchema vs on d.ItemVinSchemaId = vs.Id and vs.TobeQCed = true
	where lower(left(coalesce(d.ItemSource, ''), 7)) in ('pattern', 'formula', 'enginem', 'convers');

	if coalesce(includeNotPublicilyAvailable, false) = false then
		delete 
		from DecItem d
		where d.ItemTobeQCed = true;
	end if;

	update DecItem as t
	set ItemValue = case e.LookupTable when null then t.ItemAttributeId else (vpic.fElementAttributeValue (t.ItemElementId, t.ItemAttributeId)) end
	from vpic.Element e
	where t.ItemElementId = e.Id and t.ItemValue = 'XXX';

	if NoOutput = false then
		return query select 
			e.GroupName, 
			e.Name as Variable, 
			cast(REPLACE(REPLACE(REPLACE(t.ItemValue, CHR(9), ' '), CHR(13), ' '), CHR(10), ' ') as varchar) as Value, 
			t.ItemPatternId, 
			t.ItemVinSchemaId, 
			t.ItemKeys, 
			e.id as ItemElementId, 
			t.ItemAttributeId, 
			t.ItemCreatedOn as ItemCreatedOn, 
			t.ItemWmiId,
			e.Code, 
			e.DataType, 
			e.Decode,
			t.ItemSource, 
			t.ItemToBeQCed as ToBeQCd
		from 
			vpic.Element e
			left outer join DecItem t on t.ItemElementId = e.Id
		where 
			(coalesce(e.Decode, '') <> '') 
			and ((includeAll) = true or (coalesce(includeAll, false) = false and not t.ItemElementId is null)) 
			and (includePrivate = true or coalesce(e.IsPrivate, false) = false )
		order by
			CASE coalesce(e.GroupName, '')
			    WHEN '' THEN 0
			    WHEN 'General' THEN 1
				WHEN 'Exterior / Body' THEN 2
				WHEN 'Exterior / Dimension' THEN 3
				WHEN 'Exterior / Truck' THEN 4
				WHEN 'Exterior / Trailer' THEN 5
				WHEN 'Exterior / Wheel tire' THEN 6
				WHEN 'Exterior / Motorcycle' THEN 7
				WHEN 'Exterior / Bus' THEN 8
				WHEN 'Interior' THEN 9
				WHEN 'Interior / Seat' THEN 10
				WHEN 'Mechanical / Transmission' THEN 11
				WHEN 'Mechanical / Drivetrain' THEN 12
				WHEN 'Mechanical / Brake' THEN 13
				WHEN 'Mechanical / Battery' THEN 14
				WHEN 'Mechanical / Battery / Charger' THEN 15
				WHEN 'Engine' THEN 16
				WHEN 'Passive Safety System' THEN 17
				WHEN 'Passive Safety System / Air Bag Location' THEN 18
				WHEN 'Active Safety System' THEN 19
				WHEN 'Active Safety System / Maintaining Safe Distance' THEN 20
				WHEN 'Active Safety System / Forward Collision Prevention' THEN 21
				WHEN 'Active Safety System / Lane and Side Assist' THEN 22
				WHEN 'Active Safety System / Backing Up and Parking' THEN 23
				WHEN 'Active Safety System / 911 Notification' THEN 24
				WHEN 'Active Safety System / Lighting Technologies' THEN 25
				WHEN 'Internal' THEN 26
			    ELSE 99
			END;
	else
		-- insert into DecodingOutput (GroupName, Variable, Value, PatternId, VinSchemaId, Keys, ElementId, AttributeId, CreatedOn, WmiId, Code, DataType, Decode, Source)
		-- select 
		-- 	e.GroupName, 
		-- 	e.Name as Variable, 
		-- 	REPLACE(REPLACE(REPLACE(t.ItemValue, CHR(9), ' '), CHR(13), ' '), CHR(10), ' ') as Value, 
		-- 	t.ItemPatternId, 
		-- 	t.ItemVinSchemaId, 
		-- 	t.ItemKeys, 
		-- 	e.id as ElementId, 
		-- 	t.ItemAttributeId, 
		-- 	t.ItemCreatedOn as CreatedOn, 
		-- 	t.ItemWmiId,
		-- 	e.Code, 
		-- 	e.DataType, 
		-- 	e.Decode,
		-- 	t.ItemSource 
		-- from 
		-- 	vpic.Element e
		-- 	left outer join DecItem t on t.ItemElementId = e.Id
		-- where 
		-- 	(coalesce(e.Decode, '') <> '') 
		-- 	and ((includeAll) = true or (coalesce(includeAll, false) = false and not t.ItemElementId is null)) 
		-- 	and (includePrivate = true or coalesce(e.IsPrivate, false) = false )
		-- order by
		-- 	CASE coalesce(e.GroupName, '')
		-- 	    WHEN '' THEN 0
		-- 	    WHEN 'General' THEN 1
		-- 		WHEN 'Exterior / Body' THEN 2
		-- 		WHEN 'Exterior / Dimension' THEN 3
		-- 		WHEN 'Exterior / Truck' THEN 4
		-- 		WHEN 'Exterior / Trailer' THEN 5
		-- 		WHEN 'Exterior / Wheel tire' THEN 6
		-- 		WHEN 'Exterior / Motorcycle' THEN 7
		-- 		WHEN 'Exterior / Bus' THEN 8
		-- 		WHEN 'Interior' THEN 9
		-- 		WHEN 'Interior / Seat' THEN 10
		-- 		WHEN 'Mechanical / Transmission' THEN 11
		-- 		WHEN 'Mechanical / Drivetrain' THEN 12
		-- 		WHEN 'Mechanical / Brake' THEN 13
		-- 		WHEN 'Mechanical / Battery' THEN 14
		-- 		WHEN 'Mechanical / Battery / Charger' THEN 15
		-- 		WHEN 'Engine' THEN 16
		-- 		WHEN 'Passive Safety System' THEN 17
		-- 		WHEN 'Passive Safety System / Air Bag Location' THEN 18
		-- 		WHEN 'Active Safety System' THEN 19
		-- 		WHEN 'Active Safety System / Maintaining Safe Distance' THEN 20
		-- 		WHEN 'Active Safety System / Forward Collision Prevention' THEN 21
		-- 		WHEN 'Active Safety System / Lane and Side Assist' THEN 22
		-- 		WHEN 'Active Safety System / Backing Up and Parking' THEN 23
		-- 		WHEN 'Active Safety System / 911 Notification' THEN 24
		-- 		WHEN 'Active Safety System / Lighting Technologies' THEN 25
		-- 		WHEN 'Internal' THEN 26
		-- 	    ELSE 99
		-- 	END, e.id;
	end if;
		
	drop table DecItem;
	drop table x;
end;
$$;


--
-- TOC entry 443 (class 1255 OID 6697927)
-- Name: spvindecode_core(integer, integer, character varying, character varying, boolean, boolean, boolean, boolean, boolean); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.spvindecode_core(pass integer, modelyear integer, var_vin character varying DEFAULT ''::character varying, modelyearsource character varying DEFAULT ''::character varying, conclusive boolean DEFAULT false, error12 boolean DEFAULT false, includeall boolean DEFAULT NULL::boolean, includeprivate boolean DEFAULT false, includenotpublicilyavailable boolean DEFAULT NULL::boolean) RETURNS TABLE(coredecodingid integer, corecreatedon timestamp without time zone, corepatternid integer, corekeys character varying, corevinschemaid integer, corewmiid integer, coreelementid integer, coreattributeid character varying, corevalue character varying, coresource character varying, corepriority integer, coretobeqced boolean, corereturncode character varying)
    LANGUAGE plpgsql
    AS $_$
declare
	ReturnCode varchar(100);
	var_wmi varchar(6) = vpic.fVinWMI(var_vin);
	var_keys varchar(50) = '';
	wmiId integer;
	patternId integer;
	vinSchemaId integer;
	formulaKeys varchar(14) = '';
	cnt integer = 0;
	descriptor varchar(17) = vpic.fVinDescriptor(var_vin);
	CorrectedVIN varchar(17);
	ErrorBytes varchar(500);
	AdditionalDecodingInfo varchar(500);
	UnUsedPositions varchar(500);
	EngineModel varchar(500);
	k varchar(50);
	MfrId int;
	MfrName varchar(500);
	var_modelId integer;
	fromElementId integer;
	toElementId integer;
	formula varchar;
	params varchar;
	sql varchar;
	value varchar(500);
	conversionId integer;
	dataType varchar(50);
	cursor_item RECORD;
	result varchar(500) = '';
	tVehicleType integer;
	isOffRoad boolean = false;
	vehicleType varchar(500);
	isVinExceptionCheckDigit boolean = false;
	invalidChars varchar(500) = '';
	startPos integer = 13;
	x_vehicleTypeId integer;
	x_truckTypeId integer;
	j integer = 0;
	chr varchar(10) = '';
	isCarMpvLT boolean = false;
	CD char(1);
	calcCD char(1) = '';
	errors varchar(100);
	offRoadNote varchar(100) = ' NOTE: Disregard if this is an off-road vehicle PIN, as check digit calculation may not be accurate.';
	checkDigitExclusionNote varchar(150) = ' NOTE: Check Digit Exception - The check digit was given an exception based on data from the OEM indicating an error on production.';
	errorMessages varchar = null;
	errorCodes varchar(500) = null;
	oneError varchar(10) = '';
begin
	ReturnCode = '';

	if length(var_vin) > 3 then
		var_keys = SUBSTRING(var_vin, 4, 5);
		if length(var_vin) > 9 then
			var_keys  = var_keys || '|' || SUBSTRING(var_vin, 10, 8);
		end if;
	end if;

	-- NOTE: Unable to directly insert into custom type via select statement, needs to store it in a temp table as a column
	create temporary table IF NOT EXISTS DecodingItems (
		id SERIAL PRIMARY KEY,
		DecodingItem vpic."tblDecodingItem"
	) on commit drop;

	select Id into wmiId from vpic."wmi" where "wmi" = var_wmi and (includeNotPublicilyAvailable = true or PublicAvailabilityDate <= NOW());
	if wmiId is null then
		ReturnCode = ReturnCode || ' 7 ';
		CorrectedVIN = '';
		ErrorBytes = '';
	else
		insert into DecodingItems (DecodingItem) select ROW(
			null,
			pass,
			coalesce(P.UpdatedOn, P.CreatedOn),
			P.Id,
			upper(P.Keys),
			P.VinSchemaId,
			wvs.WmiId,
			P.ElementId,
			P.AttributeId,
			'XXX',
			'Pattern',
			wvs.YearFrom,
			vs.TobeQCed)::vpic."tblDecodingItem"
			FROM
				vpic.Pattern AS P
				INNER JOIN vpic.Element E ON P.ElementId = E.Id
				INNER JOIN vpic.VinSchema VS on p.VinSchemaId = vs.Id
				INNER JOIN vpic.Wmi_VinSchema AS wvs ON vs.Id = wvs.VinSchemaId and ((modelYear is null) or (modelYear between wvs.YearFrom and coalesce(wvs.YearTo, 2999))) 
				INNER JOIN vpic.Wmi AS w ON wvs.WmiId = w.Id and w.Wmi = var_wmi
			WHERE (
				    (p.keys NOT LIKE '%[%' AND var_keys LIKE replace(p.keys, '*', '_') || '%')
				    OR (p.keys LIKE '%[%' AND var_keys ~ p.keys_regex)
				  )
				and not P.ElementId in  (26, 27, 29, 39)
				and not E.Decode is null
				and (coalesce(E.IsPrivate, false) = false or includePrivate = coalesce(E.IsPrivate, false))
				and (includeNotPublicilyAvailable = true or (w.PublicAvailabilityDate <= NOW()))
				and (includeNotPublicilyAvailable = true or (coalesce(vs.TobeQCed, false) = false))
				ORDER BY P.Id ASC;
		
		SELECT (di.DecodingItem)."AttributeId", (di.DecodingItem)."PatternId", (di.DecodingItem)."VinSchemaId", (di.DecodingItem)."Keys"
		INTO EngineModel, patternId, vinSchemaId, k
		FROM DecodingItems di
		WHERE (di.DecodingItem)."DecodingId" = pass AND (di.DecodingItem)."ElementId" = 18
		ORDER BY (di.DecodingItem)."Priority" DESC, (di.DecodingItem)."CreatedOn" DESC, di.id DESC
		LIMIT 1;

		if not EngineModel is null then
			insert into DecodingItems (DecodingItem) select ROW(
			null, pass, coalesce(p.UpdatedOn, p.CreatedOn),
			patternId, k, vinSchemaId, wmiId, p.ElementId,
			p.AttributeId, 'XXX', 'EngineModelPattern', 50, null)::vpic."tblDecodingItem"
			from
				vpic.EngineModel em
				inner join vpic.EngineModelPattern AS p on em.Id = p.EngineModelId
				INNER JOIN vpic.Element E ON P.ElementId = E.Id
			where
				lower(trim(em.Name)) = lower(trim(EngineModel));
		end if;
	
		insert into DecodingItems (DecodingItem) select ROW(
		null, pass, coalesce(w.UpdatedOn, w.CreatedOn),
		null, upper(var_wmi), null, w.Id, 39,
		cast(t.Id as character varying), upper(t.Name), 'VehType', 100, null)::vpic."tblDecodingItem"
		from vpic.wmi w
			join vpic.VehicleType t on t.Id = w.VehicleTypeId
		where w.wmi = var_wmi
			and (includeNotPublicilyAvailable = true or (w.PublicAvailabilityDate <= NOW()));
	
		select t.id, upper(t.name) into MfrId, MfrName
		from vpic.wmi w
		join vpic.Manufacturer t ON t.id = w.ManufacturerId
		where w.wmi = var_wmi and (includeAll = true or (w.PublicAvailabilityDate <= NOW()));
	
		insert into DecodingItems (DecodingItem) select ROW(
		null, pass, null, null, upper(var_wmi), null, WmiId, 27, cast(MfrId as character varying), MfrName, 'Manu. Name', 100, null)::vpic."tblDecodingItem";
	
		insert into DecodingItems (DecodingItem) select ROW(
		null, pass, null, null, upper(var_wmi), null, WmiId, 157, cast(MfrId as character varying), cast(MfrId as character varying), 'Manu. Id', 100, null)::vpic."tblDecodingItem";
	
		insert into DecodingItems (DecodingItem) select ROW(
		null, pass, null, null, modelYearSource, null, null, 29,
		cast(modelYear as character varying), cast(modelYear as character varying), 'ModelYear', 100, null)::vpic."tblDecodingItem"
		where not modelYear is null;
	
		formulaKeys = var_keys;
		formulaKeys = replace(formulaKeys, cast(1 as text), '#');
		formulaKeys = replace(formulaKeys, cast(2 as text), '#');
		formulaKeys = replace(formulaKeys, cast(3 as text), '#');
		formulaKeys = replace(formulaKeys, cast(4 as text), '#');
		formulaKeys = replace(formulaKeys, cast(5 as text), '#');
		formulaKeys = replace(formulaKeys, cast(6 as text), '#');
		formulaKeys = replace(formulaKeys, cast(7 as text), '#');
		formulaKeys = replace(formulaKeys, cast(8 as text), '#');
		formulaKeys = replace(formulaKeys, cast(9 as text), '#');
		formulaKeys = replace(formulaKeys, cast(0 as text), '#');
	
		insert into DecodingItems (DecodingItem) select ROW(
			null, pass, coalesce(p.UpdatedOn, p.CreatedOn), p.Id, p.Keys, p.VinSchemaId, null, p.ElementId, p.AttributeId, SUBSTRING(var_keys, STRPOS(p.keys, '#'), (LENGTH(p.keys) - STRPOS(REVERSE(p.Keys), '#') + 1) - (STRPOS(p.keys, '#')) + 1), 'Formula Pattern', 100, null)::vpic."tblDecodingItem"
		from vpic.Pattern as p INNER JOIN vpic.Element E ON p.ElementId = E.Id 
		where
			p.VinSchemaId in (
				select wvs.VinSchemaId from vpic.Wmi as w
				inner join vpic.Wmi_VinSchema as wvs on w.Id = wvs.WmiId and ((modelYear is null) or (modelYear between wvs.YearFrom and coalesce(wvs.YearTo, 2999)))
				where w.Wmi = var_wmi and ((modelYear is null) or (modelYear between wvs.YearFrom and coalesce(wvs.YearTo, 2999)))
			)
			and STRPOS(p.keys, '#') > 0
			and not p.ElementId in (26, 27, 29, 39)
			and formulaKeys like replace(p.Keys, '*', '_') || '%';
	
		DELETE FROM DecodingItems
		WHERE id IN (
		    SELECT id
		    FROM (
		        SELECT 
		            d.id,
		            RANK() OVER (
		                PARTITION BY (d.DecodingItem)."ElementId" 
		                ORDER BY 
		                    (d.DecodingItem)."Priority" DESC, 
		                    (d.DecodingItem)."CreatedOn" DESC, 
		                    LENGTH(REPLACE(COALESCE((d.DecodingItem)."Keys", ''), '*', '')) ASC, 
		                    REPLACE(REPLACE(COALESCE((d.DecodingItem)."Keys", ''), '[', ''), ']', '') ASC,
		                    d.id ASC
		            ) AS RankResult
		        FROM DecodingItems d
		        WHERE (d.DecodingItem)."DecodingId" = pass 
		        AND (d.DecodingItem)."ElementId" NOT IN (121, 129, 150, 154, 155, 114, 169, 186)
		    ) t 
		    WHERE t.RankResult > 1
		);
	
		var_modelId = (di.DecodingItem)."AttributeId" FROM DecodingItems di
		WHERE (di.DecodingItem)."DecodingId" = pass AND (di.DecodingItem)."ElementId" = 28;
	
		if not var_modelId is null then
			insert into DecodingItems (DecodingItem) select ROW(
			null, pass, null,
			(di.DecodingItem)."PatternId", (di.DecodingItem)."Keys", (di.DecodingItem)."VinSchemaId", null, 26,
			mk.Id, upper(mk.name), 'pattern - model', 1000, null)::vpic."tblDecodingItem"
			from
				vpic.Make_Model mm
				inner join vpic.Make AS mk on mm.MakeId = mk.Id
				inner join DecodingItems as di on mm.ModelId = cast((di.DecodingItem)."AttributeId" as integer) and (di.DecodingItem)."DecodingId" = pass
			where
				(di.DecodingItem)."ElementId" = 28 and (di.DecodingItem)."DecodingId" = pass;
		else
			cnt = count(*)
			from vpic.wmi w
				join vpic.Wmi_Make wm on wm.WmiId = w.Id
				join vpic.Make t on t.Id = wm.MakeId
			where Wmi = var_wmi
				and (includeNotPublicilyAvailable = true or (PublicAvailabilityDate <= NOW()));

			if cnt = 1 then
				insert into DecodingItems (DecodingItem) select ROW(
				null, pass, coalesce(w.UpdatedOn, w.CreatedOn),
				null, var_wmi, null, w.Id, 26,
				cast(t.Id as character varying), upper(t.Name), 'Make', -100, null)::vpic."tblDecodingItem"
				from vpic.wmi w
					join vpic.Wmi_Make wm on wm.WmiId = w.Id
					join vpic.Make t on t.Id = wm.MakeId
				where wmi = var_wmi
					and (includeNotPublicilyAvailable = true or (w.PublicAvailabilityDate <= NOW()));
			end if;
		end if;
	
		FOR cursor_item IN
	        SELECT
	            (di.DecodingItem)."Keys",
	            (di.DecodingItem)."ElementId",
	            (di.DecodingItem)."AttributeId",
	            c.ToElementId,
	            c.Formula,
	            c.id,
	            e.DataType,
	            (di.DecodingItem)."PatternId",
	            (di.DecodingItem)."VinSchemaId",
	            (di.DecodingItem)."WmiId"
	        FROM DecodingItems di
	        INNER JOIN vpic.conversion c ON (di.DecodingItem)."ElementId" = c.FromElementId
	        INNER JOIN vpic.Element e ON c.ToElementId = e.Id
	        WHERE (di.DecodingItem)."DecodingId" = pass
	        ORDER BY (di.DecodingItem)."Priority" DESC, (di.DecodingItem)."CreatedOn" DESC, c.id
	    LOOP
	        var_keys = cursor_item."Keys";
			fromElementId = cursor_item."ElementId";
			value = cursor_item."AttributeId";
			toElementId = cursor_item.ToElementId;
			formula = cursor_item.Formula;
			conversionId = cursor_item.Id;
			dataType = cursor_item.DataType;
			patternId = cursor_item."PatternId";
			vinschemaId = cursor_item."VinSchemaId";
			wmiId = cursor_item."WmiId";
	
			if not exists (select 1 from DecodingItems di where (di.DecodingItem)."DecodingId" = pass and (di.DecodingItem)."ElementId" = toElementId) then
				formula = replace(formula, '#x#', value);
		
				if lower(dataType) = 'decimal' then
					dataType = dataType || '(12, 2)';
				end if;
		
				if lower(dataType) = 'int' then
					dataType = dataType || 'cast(round(' || formula || ',0))';
				end if;
		
				sql = 'select (' || formula || ')::varchar(500)';
		
				begin
					execute sql into result;
				exception
					when others then
						result = '0';
				end;
		
				insert into DecodingItems (DecodingItem) select ROW(
				null, pass, null, patternId, var_keys, vinschemaId, wmiId, toElementId, result, result,
				left('Conversion ' || CAST(conversionId as varchar) || ': ' || formula, 50), 100, null)::vpic."tblDecodingItem";
			end if;
	    END LOOP;

		select (di.DecodingItem)."AttributeId" into tVehicleType from DecodingItems di 
		where (di.DecodingItem)."DecodingId" = pass and (di.DecodingItem)."ElementId" = 39 limit 1;

		create temporary table IF NOT EXISTS tbl_tmpPatterns (
	        id int,
	        TobeQCed boolean
    	) on commit drop;

		create temporary table IF NOT EXISTS tbl_tmpPatternsEx (
	        id int,
	        a int,
			b int
    	) on commit drop;

		insert into tbl_tmpPatterns(id, tobeqced)
		select distinct sp.id, s.TobeQCed
		from vpic.VehicleSpecSchema as s
			inner join vpic.VSpecSchemaPattern as sp on s.id = sp.SchemaId
			inner join vpic.VehicleSpecPattern p on sp.Id = p.VSpecSchemaPatternId
			inner join vpic.VehicleSpecSchema_Model as vssm on vssm.VehicleSpecSchemaId = s.id
			left outer join vpic.VehicleSpecSchema_Year as vssy on vssy.VehicleSpecSchemaId = s.id
			inner join vpic.Wmi_Make wm on wm.MakeId = s.makeid
			inner join vpic.wmi on wmi.id = wm.WmiId
		where 1 = 1
			and wmi.wmi = var_wmi
			and s.VehicleTypeId = tVehicleType
			and vssm.ModelId = var_modelId
			and (vssy.Year = modelYear or vssy.Id is null) 
			and p.IsKey = true
			and (includeNotPublicilyAvailable = true or (coalesce(s.TobeQCed, false) = false));
  
		insert into tbl_tmpPatternsEx (id, a, b) 
		select
			p.VSpecSchemaPatternId, count(*) as cntTotal, count(distinct d.id) as cntMatch
		from
			vpic.VehicleSpecPattern as p
			inner join tbl_tmpPatterns as ptrn on p.VSpecSchemaPatternId = ptrn.id 
			left outer join DecodingItems as d on (d.DecodingItem)."DecodingId" = pass and p.ElementId = (d.DecodingItem)."ElementId" and LOWER(p.AttributeId) = LOWER((d.DecodingItem)."AttributeId")
		where 
			p.IsKey = true
		group by p.VSpecSchemaPatternId
		having count(*) <> count(distinct d.Id);

		delete from tbl_tmpPatterns where id in (select id from tbl_tmpPatternsEx); 

		create temporary table IF NOT EXISTS tbl_tbl1 (
			IsKey boolean, 
			vSpecSchemaId int, 
			vSpecPatternId int, 
			ElementId int, 
			AttributeId varchar(500), 
			ChangedOn timestamp null,
			TobeQCed boolean null
		) on commit drop;
		
		INSERT INTO tbl_tbl1 (iskey, vSpecSchemaId, vSpecPatternId, ElementId, AttributeId, ChangedOn, TobeQCed)
	    SELECT DISTINCT
	        vsp.IsKey,
	        vsvp.SchemaId,
	        vsp.vspecschemapatternid,
	        vsp.ElementId,
	        vsp.AttributeId,
	        COALESCE(vsp.UpdatedOn, vsp.CreatedOn),
	        ptrn.TobeQCed
	    FROM vpic.VehicleSpecPattern as vsp
	    INNER JOIN vpic.VSpecSchemaPattern as vsvp ON vsvp.id = vsp.vspecschemapatternid
	    INNER JOIN tbl_tmpPatterns as ptrn ON vsvp.id = ptrn.id
	    WHERE
	        vsp.IsKey = FALSE
	        AND vsp.ElementId NOT IN (
	            SELECT (di.DecodingItem)."ElementId"
	            FROM DecodingItems di
	            WHERE (di.DecodingItem)."DecodingId" = pass
	            AND (di.DecodingItem)."ElementId" NOT IN (1, 114, 121, 129, 150, 154, 155, 169, 186)
	        );

		DELETE FROM tbl_tbl1
		WHERE ctid IN (
		    SELECT ctid
		    FROM (
		        SELECT
		            ctid,
		            ROW_NUMBER() OVER(PARTITION BY elementid ORDER BY ChangedOn desc) AS rn
		        FROM tbl_tbl1
		    ) AS cte
		    WHERE rn > 1
		);

		insert into DecodingItems (DecodingItem) select distinct ROW(
			null, pass, t1.ChangedOn, t1.vSpecPatternId, '', t1.vSpecSchemaId,
			null, t1.ElementId, t1.AttributeId, 'XXX', 'Vehicle Specs', -100, t1.TobeQCed)::vpic."tblDecodingItem"
			FROM tbl_tbl1 as t1;

		if (select COUNT(*) from DecodingItems di where (di.DecodingItem)."DecodingId" = pass and not ((di.DecodingItem)."PatternId") is null) = 0 then
			ReturnCode = ReturnCode || ' 8 ';
			CorrectedVIN = '';
			ErrorBytes = '';
		else
			select err_returncode, err_correctedvin, err_errorbytes, err_unusedpositions 
			into ReturnCode, CorrectedVin, ErrorBytes, UnUsedPositions
			from vpic.spvindecode_errorcode(var_vin, modelYear);
		end if;

		drop table tbl_tmpPatterns;
		drop table tbl_tmpPatternsEx;
		drop table tbl_tbl1;
	end if;

	if exists(select 1 from DecodingItems as di where (di.DecodingItem)."DecodingId" = pass and (di.DecodingItem)."ElementId" = 5 and (di.DecodingItem)."AttributeId" = 64::varchar) then
		ReturnCode = ReturnCode || ' 9 ';
	end if;

	if exists(select 1 from DecodingItems as di where (di.DecodingItem)."DecodingId" = pass and (di.DecodingItem)."ElementId" = 5 and (di.DecodingItem)."AttributeId" in (69::varchar, 84::varchar, 86::varchar, 88::varchar, 97::varchar, 105::varchar, 113::varchar, 124::varchar, 126::varchar, 127::varchar)) then
		ReturnCode = ReturnCode || ' 10 ';
		isOffRoad = true;
	end if;

	if modelYear is null then
		ReturnCode = ReturnCode || ' 11 ';
	end if;

	select (di.DecodingItem)."AttributeId" into vehicleType from DecodingItems as di where (di.DecodingItem)."DecodingId" = pass and (di.DecodingItem)."ElementId" = 39;

	if exists(select 1 from vpic.VinException as v where v."vin" = var_vin and CheckDigit = true) then
		isVinExceptionCheckDigit = true;
	end if;

	if SUBSTRING(var_vin, 3, 1) = '9' then
		startPos = 15;
	else
		select vehicleTypeId, truckTypeId into x_vehicleTypeId, x_truckTypeId from vpic.Wmi where wmi = var_wmi;
		if x_vehicleTypeId in (2, 7) or (x_vehicleTypeId = 3 and x_truckTypeId = 1) then
			startPos = 13;
			isCarMpvLt = true;
		else
			startPos = 14;
		end if;
	end if;

	while j < length(var_vin) loop
		j = j + 1;
		if j = 9 and (isOffRoad = true or isVinExceptionCheckDigit = true) then
			continue;
		end if;

		chr = substring(var_vin, j, 1);
		if j <> 9 and j < startPos and chr !~ '^[0-9ABCDEFGHJKLMNPRSTUVWXYZ*]$'
				or j <> 9 and j >= startPos and chr !~ '^[0-9*]$'
				or j = 9 and chr !~ '^[0-9X*]$'
				or j = 10 and chr !~ '^[1-9ABCDEFGHJKLMNPRSTVWXY]$' then
			if chr = '' then
				chr = '_';
			end if;
			if CorrectedVIN = '' then
				CorrectedVIN = var_vin;
			end if;

			invalidChars = invalidChars || ', ' || cast(j as varchar(2)) || ':' || chr;
			correctedVIN = left(correctedVIN, j-1) || '!' || substring(correctedVIN, j+1, 100);
		end if;
	end loop;

	if invalidChars <> '' then
		ReturnCode = ReturnCode || ' 400 ';
	end if;

	if coalesce(Error12, false) = true then
		ReturnCode = ReturnCode || ' 12 ';
	end if;

	insert into DecodingItems (DecodingItem) select distinct ROW(
			null,
			pass,
			coalesce(dv.UpdatedOn, dv.CreatedOn),
			null,
			null,
			null,
			null,
			dv.ElementId,
			dv.DefaultValue,
			case when e.datatype = 'lookup' and dv.DefaultValue = '0' then 'Not Applicable' else 'XXX' end,
			'Default',
			10,
			null)::vpic."tblDecodingItem"
			FROM
				vpic.DefaultValue dv
				INNER JOIN vpic.Element e ON dv.ElementId = e.Id
			WHERE
				dv.VehicleTypeId = cast(vehicleType as integer) and dv.DefaultValue is not null and dv.elementid not in (select distinct (di.DecodingItem)."ElementId" from DecodingItems di where (di.DecodingItem)."DecodingId" = pass);

	if length(var_vin) < 17 then
		ReturnCode = ReturnCode || ' 6 ';
	else
		CD = substring(var_vin, 9, 1);
		calcCD = vpic.fVINCheckDigit2(var_vin, isCarmpvLT);
		if (cd <> calcCD) and (isVinExceptionCheckDigit = false) then
			ReturnCode = ReturnCode || ' 1 ';
		end if;
	end if;

	errors = ReturnCode;
	errors = replace(errors, ' 9 ', '');
	errors = replace(errors, ' 10 ', '');
	errors = replace(errors, ' 12 ', '');
	errors = trim(errors);

	if errors = '' or errors = '14' then
		ReturnCode = ' 0 ' || ReturnCode;
	end if;

	select count(*) into cnt from DecodingItems as di where (di.DecodingItem)."ElementId" = 28;

	if ReturnCode like '% 0 %' and cnt = 0 then
		ReturnCode = ReturnCode || ' 14 ';
	end if;

	if ReturnCode like '% 4 %' then
		select coalesce(additionalerrortext, '') into AdditionalDecodingInfo from vpic.ErrorCode where id = 4;
	end if;
	if ReturnCode like '% 5 %' then
		select coalesce(additionalerrortext, '') into AdditionalDecodingInfo from vpic.ErrorCode where id = 5;
	end if;
	if ReturnCode like '% 14 %' then
		AdditionalDecodingInfo = SUBSTRING(trim(coalesce(AdditionalDecodingInfo, '') || ' Unused position(s): ' || UnUsedPositions || '. ') from 1 for 500);
	end if;
	if ReturnCode like '% 400 %' then
		AdditionalDecodingInfo = SUBSTRING(trim(coalesce(AdditionalDecodingInfo, '') || ' Invalid character(s): ' || SUBSTRING(invalidChars, 3, LENGTH(invalidChars) - 2) || '. ') from 1 for 500);
	end if;

	if vehicleType = cast(10 as varchar) or exists(select 1 from DecodingItems di where (di.DecodingItem)."ElementId" = 5 and (di.DecodingItem)."AttributeId" in (65::varchar, 107::varchar, 70::varchar, 74::varchar, 63::varchar, 72::varchar, 112::varchar, 62::varchar, 64::varchar, 76::varchar, 78::varchar, 71::varchar, 77::varchar, 67::varchar, 116::varchar, 75::varchar) and (di.DecodingItem)."DecodingId" = pass) then
		AdditionalDecodingInfo = SUBSTRING(trim(coalesce(AdditionalDecodingInfo, '') || ' Incomplete Vehicle Warning - Please be advised that the vehicle may have been altered and may not be an accurate representation of the vehicle in its current condition. ') from 1 for 500);
	end if;

	if conclusive = false then
		AdditionalDecodingInfo = SUBSTRING(trim(coalesce(AdditionalDecodingInfo, '') || ' The Model Year decoded for this VIN may be incorrect. If you know the Model year, please enter it and decode again to get more accurate information. ') from 1 for 500);
	end if;

	SELECT 
        string_agg(trim(name), '; '),
        string_agg(id::TEXT, ',')
    INTO errorMessages, errorCodes
    FROM (
        SELECT 
            id,
            Name ||
                CASE
                    WHEN isOffRoad = true AND id = 1 THEN offRoadNote
                    WHEN isVinExceptionCheckDigit = true AND id = 0 THEN checkDigitExclusionNote
                    ELSE ''
                END AS name
        FROM vpic.ErrorCode
        WHERE ReturnCode LIKE '% ' || id::TEXT || ' %'
        ORDER BY id
    ) AS t;

	  errorMessages = left(errorMessages, 500);

	  insert into DecodingItems (DecodingItem) select distinct ROW(
			null, pass, null, null, '', null, null, p.ElementId, p.AttributeId, p.Value, 'Corrections', 999, null)::vpic."tblDecodingItem"
		from (
			select 142 as ElementId, CorrectedVIN as AttributeId, CorrectedVIN as Value
			union 
			select 143, errorCodes, errorCodes 
			union 
			select 191, errorMessages, errorMessages 
			union 
			select 144, ErrorBytes, ErrorBytes
			union 
			select 156, AdditionalDecodingInfo, AdditionalDecodingInfo
			union 
			select 196, descriptor, descriptor 
		) as p; 

	return query select (di.DecodingItem)."DecodingId" as CoreDecodingId, (di.DecodingItem)."CreatedOn" as CoreCreatedOn,
	(di.DecodingItem)."PatternId" as CorePatternId, (di.DecodingItem)."Keys" as COreKeys, (di.DecodingItem)."VinSchemaId" as CoreVinSchemaId,
	(di.DecodingItem)."WmiId" as CoreWmiId, (di.DecodingItem)."ElementId" as CoreElementId, (di.DecodingItem)."AttributeId" as CoreAttributeId,
	(di.DecodingItem)."Value" as CoreValue, (di.DecodingItem)."Source" as CoreSource, (di.DecodingItem)."Priority" as CorePriority, (di.DecodingItem)."TobeQCed" as CoreTobeQCed, ReturnCode as CoreReturnCode from DecodingItems di;
	
	drop table DecodingItems;
end;
$_$;


--
-- TOC entry 444 (class 1255 OID 6697929)
-- Name: spvindecode_errorcode(character varying, integer); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.spvindecode_errorcode(vin character varying, modelyear integer, OUT err_returncode character varying, OUT err_correctedvin character varying, OUT err_errorbytes character varying, OUT err_unusedpositions character varying) RETURNS record
    LANGUAGE plpgsql
    AS $$
declare 
    var_wmi varchar(6) = vpic.fVinWMI(vin);
    corrected varchar(17) = '';
    possibilities varchar(50) = '';
    replacements varchar(2000) = '';
    x varchar(50);
    i int = 3;
    n int = 14;
    var_c char(1);
    cntTotal int;
    cntMatch int;
    r varchar(50);
    cntErrors int = 0;
    lastErrorPos int = 0;
    lastReplacements varchar(50);
    tmpRowCount int = 0;
    current_c varchar = 0;
    tmpVin varchar(17);
    goodReplacements int = 0;
    NewReplacements varchar(50) = '';
    Corrected1 varchar(17);
    chr char(1);
    key varchar(100);
    b boolean = false;
    unUsedPos varchar(100) = '';
    ubound int = 11;
begin
    err_correctedvin = '';
    err_errorbytes = '';
    err_returncode = '';
    vin = trim(vin);
    
    if length(var_wmi) < 3 then 
        err_returncode = err_returncode || ' 6 ';
        return;
    end if;

    create temporary table IF NOT EXISTS tbl_spVinDecode_ErrorCode (
        p int,
        c char(1)
    ) on commit drop;

    INSERT INTO tbl_spVinDecode_ErrorCode(p, c) 
    SELECT position, "char"
    FROM (
        SELECT DISTINCT position, "char" 
        FROM vpic.WMIYearValidChars 
        WHERE wmi = var_wmi AND year = modelYear 
          AND var_wmi NOT IN (SELECT DISTINCT wmi FROM vpic.WMIYearValidChars_CacheExceptions) 
    ) t
    ORDER BY position, CASE WHEN "char" = '_' THEN 0 ELSE 1 END, "char";

    SELECT COUNT(*) INTO tmpRowCount FROM tbl_spVinDecode_ErrorCode;

    if tmpRowCount = 0 then
        insert into tbl_spVinDecode_ErrorCode(p, c) 
        select p, c
        from (
            select distinct p, c 
            from vpic.fExtractValidCharsPerWmiYear(var_wmi, cast(modelYear as smallint)) 
        ) t
        order by p, CASE WHEN c = '_' THEN 0 ELSE 1 END, c;
    end if;

    if length(var_wmi) = 6 then 
        n = 11; 
    end if;

    while (i < n) and (i < length(vin)) loop
        i = i + 1;
        var_c = substring(vin, i, 1);
        if i = 9 or i = 10 then 
            r = var_c;
        else 
            cntTotal = COUNT(*) from tbl_spVinDecode_ErrorCode where p = i;
            cntMatch = COUNT(*) from tbl_spVinDecode_ErrorCode where p = i and c = var_c;
            if cntTotal > 0 then
                if cntMatch > 0 then 
                    r = var_c;
                else 
                    r = '!';
                    x = '';
                    FOR current_c IN 
                        SELECT c 
                        FROM tbl_spVinDecode_ErrorCode 
                        WHERE p = i 
                        ORDER BY CASE WHEN c = '_' THEN 0 ELSE 1 END, c 
                    LOOP
                        x = x || current_c;
                    END LOOP;
                    replacements = replacements || '(' || CAST(i as varchar) || ':' || x || ')';
                    cntErrors = cntErrors + 1;
                    lastErrorPos = i;
                    lastReplacements = x;
                end if;
            else 
                r = var_c;
            end if;
        end if;
        corrected = corrected || r;
    end loop;

    if length(var_wmi) = 3 then 
        corrected = var_wmi || corrected;
    else 
        corrected = left(var_wmi, 3) || corrected || RIGHT(var_wmi, 3);
    end if;

    if length(vin) > length(corrected) then 
        corrected = corrected || SUBSTRING(vin, length(corrected)+1, 3);
    end if;

    if cntErrors = 1 then
        if length(lastReplacements) = 1 then
            corrected = substring(vin, 1,lastErrorPos-1) || lastReplacements || substring(vin, lastErrorPos+1, 17-lastErrorPos);
            err_returncode = err_returncode || ' 2 ';
            err_correctedvin = Corrected;
            err_errorbytes = replacements;
        else 
            i = 0;
            while i < length(lastReplacements) loop
                i = i + 1;
                var_c = SUBSTRING(lastReplacements, i, 1);
                tmpVin = substring(vin, 1, lastErrorPos-1) || var_c || substring(vin, lastErrorPos+1, 17-lastErrorPos);
                if SUBSTRING(tmpVin, 9, 1) = vpic.fVINCheckDigit(tmpVin) then
                    goodReplacements = goodReplacements + 1;
                    NewReplacements = NewReplacements || var_c;
                    Corrected1 = tmpVin;
                end if;
            end loop;

            if goodReplacements = 1 then
                err_returncode = err_returncode || ' 3 ';
                err_correctedvin = Corrected1;
                err_errorbytes = '(' || CAST(lastErrorPos as varchar) || ':' || NewReplacements || ')';
            else 
                err_returncode = err_returncode || ' 4 ';
                err_correctedvin = Corrected;
                err_errorbytes = '(' || CAST(lastErrorPos as varchar) || ':' || lastReplacements || ')';
            end if;
        end if;
    end if;

    if cntErrors > 1 then
        err_returncode = err_returncode || ' 5 ';
        err_correctedvin = Corrected;
        err_errorbytes = replacements;
    end if;

    create temporary table IF NOT EXISTS tbl_spVinDecode_ErrorCode1 (
        p int,
        c char(1)
    ) on commit drop;

    create temporary table IF NOT EXISTS tbl_spVinDecode_ErrorCodeY (
        p int,
        c char(1)
    ) on commit drop;

    i = (select min(o."id") from DecodingItems as o);
    while i <= (select max(o."id") from DecodingItems as o) loop
        key = null;
        key = (o.DecodingItem)."Keys" from DecodingItems as o where o."id" = i and (o.DecodingItem)."Source" ilike '%pattern%';
        if coalesce(key, '') <> '' then
            insert into tbl_spVinDecode_ErrorCode1 select * from vpic.fValidCharsInKey(key) where return_chr <> '|';
        end if;
        i = i + 1;
    end loop;

    insert into tbl_spVinDecode_ErrorCodeY select distinct * from tbl_spVinDecode_ErrorCode1;

    i = 3;
    if length(vin) < ubound then 
        ubound = length(vin); 
    end if;

    while i < ubound loop
        i = i + 1;
        if not i in (4, 5, 6, 7, 8, 11) then 
            continue; 
        end if;
        chr = SUBSTRING(vin, i, 1);
        b = false;
        if exists(select c from tbl_spVinDecode_ErrorCodeY where p +3 = i and c = chr) then 
            b = true; 
        end if;
        if b = false then 
            unUsedPos = unUsedPos || ' ' || cast(i as varchar); 
        end if;
    end loop;

    unUsedPos = replace(trim(unUsedPos), ' ', ',');
    if unUsedPos <> '' then
        err_returncode = err_returncode || ' 14 ';
        err_unusedpositions = unUsedPos;
    end if;

    drop table tbl_spVinDecode_ErrorCode;
    drop table tbl_spVinDecode_ErrorCode1;
    drop table tbl_spVinDecode_ErrorCodeY;
end; 
$$;


--
-- TOC entry 441 (class 1255 OID 6697924)
-- Name: spvindecodemultiple(character varying[]); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.spvindecodemultiple(vin_list character varying[]) RETURNS TABLE(vin character varying, manufacturer character varying, make character varying, model character varying, modelyear character varying, "trim" character varying, series character varying, cleandecode boolean)
    LANGUAGE plpgsql
    AS $$
declare
	v_len integer;
	v_max_limit constant integer := 100;
begin
	if vin_list is null then
		return;
	end if;

	v_len = cardinality(vin_list);

	if v_len = 0 then
		return;
	end if;

	if v_len > v_max_limit then
		raise exception 'Input array exceeds maximum allowed size of % elements (received %)', v_max_limit, v_len
		using errcode = 'array_subscript_error';
	end if;

	return query
	select
		u.vin::character varying(17) as vin,
		max(case when d.variable = 'Manufacturer Name' then d.value end)::character varying as manufacturer,
		max(case when d.variable = 'Make' then d.value end)::character varying as make,
		max(case when d.variable = 'Model' then d.value end)::character varying as model,
		max(case when d.variable = 'Model Year' then d.value end)::character varying as modelyear,
		max(case when d.variable = 'Trim' then d.value end)::character varying as "trim",
		max(case when d.variable = 'Series' then d.value end)::character varying as series,
		btrim(max(case when d.variable = 'Error Code' then d.value end)) in ('0', '0,10', '1,10', '1,400', '1,10,400') as cleandecode
	from unnest(vin_list) with ordinality as u(vin, ord)
	left join lateral vpic.spvindecode(v := u.vin) as d on true
	group by u.vin, u.ord
	order by u.ord;
end;
$$;


--
-- TOC entry 419 (class 1255 OID 6697901)
-- Name: sqlwild_to_regex(text); Type: FUNCTION; Schema: vpic; Owner: -
--

CREATE FUNCTION vpic.sqlwild_to_regex(pattern text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  ch   text;
  out  text := '';
BEGIN
  FOR i IN 1..length(pattern) LOOP
    ch := substr(pattern, i, 1);
    IF ch = '*' THEN
      out := out || '.';
    ELSIF ch IN ('[',']') THEN
      out := out || ch;
    ELSIF ch = '|' THEN
      out := out || '\|';
    ELSIF ch ~ '[\\\.\^\$\+\?\{\}\(\)]' THEN
      out := out || '\' || ch;
    ELSE
      out := out || ch;
    END IF;
  END LOOP;

  out = REPLACE(out, '1-A', '1A');

  RETURN '^' || out || '.*';
END;
$_$;

